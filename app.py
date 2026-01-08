from flask import Flask, request, jsonify, session, send_from_directory
from flask_cors import CORS
import sqlite3
import os
from datetime import datetime, timedelta
import hashlib
import secrets

app = Flask(__name__)
app.secret_key = secrets.token_hex(32)
CORS(app)

# 数据库文件路径
DB_PATH = 'calendar.db'

def init_db():
    """初始化数据库，创建需要的表"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # 创建用户表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # 创建日历事件表（status 可以为空，代表未设置状态）
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS calendar_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            date DATE NOT NULL,
            status TEXT CHECK (status IN ('busy', 'free', 'date', 'none')),
            note TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id),
            UNIQUE(user_id, date)
        )
    ''')
    
    # 插入默认用户（情侣两人）
    default_users = [
        ('alice', 'alice123'),
        ('bob', 'bob123')
    ]
    
    for username, password in default_users:
        hashed_password = hashlib.sha256(password.encode()).hexdigest()
        cursor.execute('''
            INSERT OR IGNORE INTO users (username, password) 
            VALUES (?, ?)
        ''', (username, hashed_password))
    
    conn.commit()
    conn.close()

def get_db_connection():
    """获取数据库连接"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

@app.before_request
def before_request():
    """在请求之前初始化数据库"""
    if not os.path.exists(DB_PATH):
        init_db()

def _get_date_range(year, month):
    """获取指定年月的起始和结束日期"""
    try:
        year = int(year)
        month = int(month)
        start_date = f'{year:04d}-{month:02d}-01'
        
        # 计算下个月的第一天
        if month == 12:
            end_date = f'{year+1:04d}-01-01'
        else:
            end_date = f'{year:04d}-{month+1:02d}-01'
        return start_date, end_date
    except ValueError:
        return None, None

def _fetch_events_for_user(user_id, year, month):
    """获取指定用户的日历数据"""
    start_date, end_date = _get_date_range(year, month)
    if not start_date or not end_date:
        return None
    
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT date, status, note FROM calendar_events 
            WHERE user_id = ? AND date >= ? AND date < ?
        ''', (user_id, start_date, end_date))
        
        events = {row['date']: {'status': row['status'], 'note': row['note']} 
                  for row in cursor.fetchall()}
        return events
    finally:
        conn.close()

@app.route('/api/login', methods=['POST'])
def login():
    """用户登录"""
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({'success': False, 'message': '请输入用户名和密码'})
    
    # 密码哈希
    hashed_password = hashlib.sha256(password.encode()).hexdigest()
    
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT id, username FROM users WHERE username = ? AND password = ?', 
                   (username, hashed_password))
    user = cursor.fetchone()
    conn.close()
    
    if user:
        session['user_id'] = user['id']
        session['username'] = user['username']
        return jsonify({
            'success': True, 
            'message': '登录成功',
            'user': {'id': user['id'], 'username': user['username']}
        })
    else:
        return jsonify({'success': False, 'message': '用户名或密码错误'})

@app.route('/api/logout', methods=['POST'])
def logout():
    """用户登出"""
    session.clear()
    return jsonify({'success': True, 'message': '已退出登录'})

@app.route('/api/check_auth', methods=['GET'])
def check_auth():
    """检查登录状态"""
    if 'user_id' in session:
        return jsonify({
            'success': True,
            'user': {'id': session['user_id'], 'username': session['username']}
        })
    return jsonify({'success': False})

@app.route('/api/calendar/<year>/<month>', methods=['GET'])
def get_calendar(year, month):
    """获取指定年月的日历数据"""
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': '未登录'})
    
    user_id = session['user_id']
    events = _fetch_events_for_user(user_id, year, month)
    
    if events is None:
        return jsonify({'success': False, 'message': '无效的日期格式'})
    
    return jsonify({'success': True, 'events': events})

@app.route('/api/calendar/event', methods=['POST', 'PUT', 'DELETE'])
def manage_event():
    """管理日历事件（创建、更新、删除）"""
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': '未登录'})
    
    user_id = session['user_id']
    data = request.json
    
    date = data.get('date')
    status = data.get('status')  # 'busy', 'free', 'date', 'none', or null/empty
    note = data.get('note', '')
    
    if not date:
        return jsonify({'success': False, 'message': '日期不能为空'})
    
    # 验证日期格式
    try:
        datetime.strptime(date, '%Y-%m-%d')
    except ValueError:
        return jsonify({'success': False, 'message': '无效的日期格式，请使用YYYY-MM-DD格式'})
    
    # 处理状态：如果状态为空或'none'，则设置为 NULL
    if not status or status == 'none' or status == '':
        db_status = None
    elif status not in ['busy', 'free', 'date']:
        return jsonify({'success': False, 'message': '无效的状态值'})
    else:
        db_status = status
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        if request.method == 'POST':
            # 创建新事件
            cursor.execute('''
                INSERT INTO calendar_events (user_id, date, status, note) 
                VALUES (?, ?, ?, ?)
            ''', (user_id, date, db_status, note))
            conn.commit()
            return jsonify({'success': True, 'message': '事件已创建'})
            
        elif request.method == 'PUT':
            # 更新事件
            cursor.execute('''
                UPDATE calendar_events 
                SET status = ?, note = ?, updated_at = CURRENT_TIMESTAMP
                WHERE user_id = ? AND date = ?
            ''', (db_status, note, user_id, date))
            
            if cursor.rowcount == 0:
                # 如果记录不存在，创建它
                cursor.execute('''
                    INSERT INTO calendar_events (user_id, date, status, note) 
                    VALUES (?, ?, ?, ?)
                ''', (user_id, date, db_status, note))
            
            conn.commit()
            return jsonify({'success': True, 'message': '事件已更新'})
            
        elif request.method == 'DELETE':
            # 删除事件
            cursor.execute('''
                DELETE FROM calendar_events 
                WHERE user_id = ? AND date = ?
            ''', (user_id, date))
            conn.commit()
            return jsonify({'success': True, 'message': '事件已删除'})
            
    except sqlite3.IntegrityError:
        conn.rollback()
        return jsonify({'success': False, 'message': '操作失败，可能日期已存在'})
    except Exception as e:
        conn.rollback()
        return jsonify({'success': False, 'message': f'服务器错误: {str(e)}'})
    finally:
        conn.close()

@app.route('/api/user/events', methods=['GET'])
def get_user_events():
    """获取用户的所有事件（用于数据导出）"""
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': '未登录'})
    
    user_id = session['user_id']
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT date, status, note, created_at, updated_at 
        FROM calendar_events 
        WHERE user_id = ?
        ORDER BY date
    ''', (user_id,))
    
    events = [dict(row) for row in cursor.fetchall()]
    conn.close()
    
    return jsonify({'success': True, 'events': events})

@app.route('/api/partner/events/<year>/<month>', methods=['GET'])
def get_partner_events(year, month):
    """获取伴侣的日历数据（用于对比显示）"""
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': '未登录'})
    
    user_id = session['user_id']
    
    # 获取伴侣ID（简单的实现：找到另一个用户）
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT id FROM users WHERE id != ? LIMIT 1', (user_id,))
    partner = cursor.fetchone()
    conn.close()
    
    if not partner:
        return jsonify({'success': False, 'message': '未找到伴侣用户'})
    
    partner_id = partner['id']
    events = _fetch_events_for_user(partner_id, year, month)
    
    if events is None:
        return jsonify({'success': False, 'message': '无效的日期格式'})
    
    return jsonify({'success': True, 'events': events})

@app.route('/api/stats', methods=['GET'])
def get_stats():
    """获取统计数据（如共同空闲时间等）"""
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': '未登录'})
    
    user_id = session['user_id']
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 获取当前用户和伴侣的ID
    cursor.execute('SELECT id FROM users WHERE id != ? LIMIT 1', (user_id,))
    partner = cursor.fetchone()
    
    if not partner:
        conn.close()
        return jsonify({'success': False, 'message': '未找到伴侣用户'})
    
    partner_id = partner['id']
    
    # 获取未来30天的数据
    today = datetime.now().strftime('%Y-%m-%d')
    future_date = (datetime.now() + timedelta(days=30)).strftime('%Y-%m-%d')
    
    # 查询两个用户的日历数据
    cursor.execute('''
        SELECT user_id, date, status FROM calendar_events 
        WHERE (user_id = ? OR user_id = ?) 
        AND date >= ? AND date < ?
        ORDER BY date
    ''', (user_id, partner_id, today, future_date))
    
    events = cursor.fetchall()
    
    # 统计共同空闲时间
    user_events = {}
    partner_events = {}
    
    for event in events:
        if event['user_id'] == user_id:
            user_events[event['date']] = event['status']
        else:
            partner_events[event['date']] = event['status']
    
    # 找出共同空闲的日子
    common_free_days = []
    for date in user_events:
        if date in partner_events:
            if user_events[date] == 'free' and partner_events[date] == 'free':
                common_free_days.append(date)
    
    # 统计各种状态的数量
    status_counts = {'busy': 0, 'free': 0, 'date': 0}
    for event in events:
        if event['user_id'] == user_id:
            status_counts[event['status']] += 1
    
    conn.close()
    
    return jsonify({
        'success': True,
        'stats': {
            'common_free_days': common_free_days,
            'common_free_count': len(common_free_days),
            'user_status_counts': status_counts,
            'next_30_days': (today, future_date)
        }
    })

@app.route('/')
def index():
    """提供主页面"""
    return send_from_directory('.', 'index.html')

@app.route('/<path:filename>')
def serve_static(filename):
    """提供静态文件"""
    return send_from_directory('.', filename)

if __name__ == '__main__':
    # 确保数据库已初始化
    if not os.path.exists(DB_PATH):
        init_db()
    
    print("正在启动情侣日历服务器...")
    print("默认用户: alice/alice123, bob/bob123")
    print("访问地址: http://localhost:5000")
    app.run(debug=True, port=5000)
