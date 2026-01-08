import sqlite3
import os

DB_PATH = 'calendar.db'

def migrate_database():
    """迁移数据库以允许 status 为 NULL"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # 检查旧表是否存在
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='calendar_events_old'")
        if cursor.fetchone():
            print("发现 calendar_events_old 表，开始迁移...")
            
            # 创建新表
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
            
            # 复制数据
            cursor.execute('''
                INSERT INTO calendar_events (id, user_id, date, status, note, created_at, updated_at)
                SELECT id, user_id, date, status, note, created_at, updated_at
                FROM calendar_events_old
            ''')
            
            # 删除旧表
            cursor.execute('DROP TABLE calendar_events_old')
            
            print(f"数据库迁移成功完成！迁移了 {cursor.rowcount} 条记录。")
            
            # conn.commit() 和 conn.close() 将在 finally 块中执行
            return
        
        # 检查是否有 calendar_events 表（可能已经是最新结构）
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='calendar_events'")
        if cursor.fetchone():
            print("calendar_events 表已存在，检查结构...")
            cursor.execute("PRAGMA table_info(calendar_events)")
            columns = cursor.fetchall()
            for col in columns:
                if col[1] == 'status' and col[3] == 0:  # 第4列是notnull标志
                    print("calendar_events 表 status 字段已可为 NULL，无需迁移")
                    # 不提前关闭连接，由 finally 块处理
                    return
            print("calendar_events 表需要更新结构...")
            # 备份现有表
            cursor.execute('ALTER TABLE calendar_events RENAME TO calendar_events_backup')
            # 创建新表
            cursor.execute('''
                CREATE TABLE calendar_events (
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
            # 复制数据
            cursor.execute('''
                INSERT INTO calendar_events (id, user_id, date, status, note, created_at, updated_at)
                SELECT id, user_id, date, status, note, created_at, updated_at
                FROM calendar_events_backup
            ''')
            cursor.execute('DROP TABLE calendar_events_backup')
            print(f"数据库结构更新完成！迁移了 {cursor.rowcount} 条记录。")
        else:
            print("没有找到日历事件表，将重新创建...")
            cursor.execute('''
                CREATE TABLE calendar_events (
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
            print("创建了新的 calendar_events 表。")
        
        print("数据库迁移成功完成！")
        
    except Exception as e:
        print(f"迁移失败: {e}")
        conn.rollback()
        raise
    finally:
        conn.commit()
        conn.close()

if __name__ == '__main__':
    migrate_database()
