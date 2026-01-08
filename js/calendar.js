// 情侣日历 - 前端逻辑

class CalendarApp {
    constructor() {
        this.currentDate = new Date();
        this.currentYear = this.currentDate.getFullYear();
        this.currentMonth = this.currentDate.getMonth();
        this.selectedDate = null;
        this.userEvents = {};     // 当前用户的事件 {date: {status, note}}
        this.partnerEvents = {};  // 伴侣的事件
        this.currentUser = null;
        this.contextMenu = null;
        this.tooltip = null;
        this.tooltipTimer = null;
        this.animatedDates = new Set(); // 记录已经播放过爱心气泡动画的日期
        this.pollInterval = null; // 数据轮询定时器
        
        // 初始化
        this.init();
    }

    async init() {
        // 检查登录状态
        await this.checkAuth();
        
        // 绑定事件监听器
        this.bindEvents();
        
        // 初始化日历
        this.renderCalendar();
        
        // 加载当前月份数据
        await this.loadCalendarData();
        
        // 更新统计数据
        await this.updateStats();
    }

    async checkAuth() {
        try {
            const response = await fetch('/api/check_auth');
            const data = await response.json();
            
            if (data.success) {
                this.currentUser = data.user;
                this.showLoggedInState();
                this.hideLoginModal();
            } else {
                this.showLoginModal();
            }
        } catch (error) {
            console.error('检查登录状态失败:', error);
            this.showLoginModal();
        }
    }

    showLoggedInState() {
        const loginStatus = document.getElementById('loginStatus');
        const userName = document.getElementById('userName');
        
        if (loginStatus && userName) {
            loginStatus.style.display = 'block';
            userName.textContent = `欢迎, ${this.currentUser.username}`;
        }
        
        // 启动数据轮询，检测伴侣状态变化
        this.startPolling();
    }

    hideLoginModal() {
        const loginModal = document.getElementById('loginModal');
        if (loginModal) {
            loginModal.style.display = 'none';
        }
    }

    showLoginModal() {
        const loginModal = document.getElementById('loginModal');
        if (loginModal) {
            loginModal.style.display = 'flex';
        }
    }

    bindEvents() {
        // 登录按钮
        const loginBtn = document.getElementById('loginBtn');
        if (loginBtn) {
            loginBtn.addEventListener('click', () => this.handleLogin());
        }

        // 登录表单回车键
        const usernameInput = document.getElementById('username');
        const passwordInput = document.getElementById('password');
        
        if (usernameInput && passwordInput) {
            usernameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.handleLogin();
            });
            passwordInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.handleLogin();
            });
        }

        // 退出登录按钮
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.handleLogout());
        }

        // 日历导航按钮
        const prevMonthBtn = document.getElementById('prevMonthBtn');
        const nextMonthBtn = document.getElementById('nextMonthBtn');
        const todayBtn = document.getElementById('todayBtn');
        
        if (prevMonthBtn) {
            prevMonthBtn.addEventListener('click', () => this.changeMonth(-1));
        }
        if (nextMonthBtn) {
            nextMonthBtn.addEventListener('click', () => this.changeMonth(1));
        }
        if (todayBtn) {
            todayBtn.addEventListener('click', () => this.goToToday());
        }

        // 状态选择按钮
        const statusButtons = document.querySelectorAll('.status-btn');
        statusButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const status = e.target.getAttribute('data-status');
                if (this.selectedDate) {
                    this.updateDateStatus(status);
                }
            });
        });

        // 保存备注按钮
        const saveNoteBtn = document.getElementById('saveNoteBtn');
        if (saveNoteBtn) {
            saveNoteBtn.addEventListener('click', () => this.saveNote());
        }

        // 备注输入框回车键
        const dateNoteInput = document.getElementById('dateNote');
        if (dateNoteInput) {
            dateNoteInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.saveNote();
            });
        }

        // 关闭模态框按钮
        const closeButtons = document.querySelectorAll('.close');
        closeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const modal = btn.closest('.modal');
                if (modal) {
                    modal.style.display = 'none';
                }
            });
        });

// 点击模态框外部关闭
window.addEventListener('click', (e) => {
    if (e.target.id === 'loginModal') return;
    if (e.target.classList.contains('modal')) {
        e.target.style.display = 'none';
    }
});

        // 绑定备注模态框事件
        this.bindNoteModalEvents();

        // 初始化右键菜单
        this.initContextMenu();
    }

    async handleLogin() {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const loginError = document.getElementById('loginError');

        if (!username || !password) {
            loginError.textContent = '请输入用户名和密码';
            loginError.style.display = 'block';
            return;
        }

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (data.success) {
                this.currentUser = data.user;
                this.showLoggedInState();
                this.hideLoginModal();
                this.loadCalendarData();
                this.updateStats();
            } else {
                loginError.textContent = data.message || '登录失败';
                loginError.style.display = 'block';
            }
        } catch (error) {
            console.error('登录失败:', error);
            loginError.textContent = '网络错误，请稍后重试';
            loginError.style.display = 'block';
        }
    }

    async handleLogout() {
        try {
            await fetch('/api/logout', { method: 'POST' });
            this.currentUser = null;
            this.userEvents = {};
            this.partnerEvents = {};
            
            // 停止数据轮询
            this.stopPolling();
            
            // 隐藏登录状态
            const loginStatus = document.getElementById('loginStatus');
            if (loginStatus) loginStatus.style.display = 'none';
            
            // 显示登录模态框
            this.showLoginModal();
            
            // 重置日历显示
            this.renderCalendar();
        } catch (error) {
            console.error('退出登录失败:', error);
        }
    }

    changeMonth(delta) {
        this.currentMonth += delta;
        
        // 处理月份溢出
        if (this.currentMonth < 0) {
            this.currentMonth = 11;
            this.currentYear--;
        } else if (this.currentMonth > 11) {
            this.currentMonth = 0;
            this.currentYear++;
        }
        
        // 清除动画记录，因为月份变了
        this.animatedDates.clear();
        
        this.renderCalendar();
        this.loadCalendarData();
        this.updateStats();
    }

    goToToday() {
        this.currentDate = new Date();
        this.currentYear = this.currentDate.getFullYear();
        this.currentMonth = this.currentDate.getMonth();
        
        this.renderCalendar();
        this.loadCalendarData();
        this.updateStats();
    }

    renderCalendar() {
        const calendarGrid = document.getElementById('calendarGrid');
        const currentMonthElem = document.getElementById('currentMonth');
        
        if (!calendarGrid || !currentMonthElem) return;
        
        // 更新月份标题
        const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', 
                          '七月', '八月', '九月', '十月', '十一月', '十二月'];
        currentMonthElem.textContent = `${this.currentYear}年${monthNames[this.currentMonth]}`;
        
        // 清空日历网格（保留星期标题行）
        const headerRow = calendarGrid.querySelector('.calendar-header-row');
        calendarGrid.innerHTML = '';
        if (headerRow) {
            calendarGrid.appendChild(headerRow);
        } else {
            // 创建星期标题行
            const headerRow = document.createElement('div');
            headerRow.className = 'calendar-header-row';
            const daysOfWeek = ['日', '一', '二', '三', '四', '五', '六'];
            daysOfWeek.forEach(day => {
                const dayElem = document.createElement('div');
                dayElem.className = 'calendar-day-header';
                dayElem.textContent = day;
                headerRow.appendChild(dayElem);
            });
            calendarGrid.appendChild(headerRow);
        }
        
        // 计算月份信息
        const firstDay = new Date(this.currentYear, this.currentMonth, 1);
        const lastDay = new Date(this.currentYear, this.currentMonth + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDay = firstDay.getDay(); // 0 = 周日, 1 = 周一, ...
        
        // 创建日历网格
        const gridContainer = document.createElement('div');
        gridContainer.className = 'calendar-grid-container';
        
        // 添加空白单元格
        for (let i = 0; i < startingDay; i++) {
            const emptyCell = document.createElement('div');
            emptyCell.className = 'calendar-day empty';
            gridContainer.appendChild(emptyCell);
        }
        
        // 添加日期单元格
        const today = new Date();
        today.setHours(0, 0, 0, 0); // 将时间设置为午夜，以便准确比较日期
        const todayStr = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
        
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(this.currentYear, this.currentMonth, day);
            date.setHours(0, 0, 0, 0); // 设置时间为午夜
            const dateStr = `${this.currentYear}-${(this.currentMonth + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
            
            const dayCell = document.createElement('div');
            dayCell.className = 'calendar-day';
            dayCell.dataset.date = dateStr;
            
            // 标记今天
            if (dateStr === todayStr) {
                dayCell.classList.add('today');
            }
            
            // 标记过去日期
            if (date < today) {
                dayCell.classList.add('past-day');
            }
            
            // 日期数字
            const dayNumber = document.createElement('div');
            dayNumber.className = 'day-number';
            dayNumber.textContent = day;
            dayCell.appendChild(dayNumber);
            
            // 创建左右两侧的状态区域
            const sidePartner = document.createElement('div');
            sidePartner.className = 'side side-partner';
            sidePartner.setAttribute('data-side', 'partner');
            dayCell.appendChild(sidePartner);
            
            const sideSelf = document.createElement('div');
            sideSelf.className = 'side side-self';
            sideSelf.setAttribute('data-side', 'self');
            dayCell.appendChild(sideSelf);
            
            // 点击事件
            dayCell.addEventListener('click', () => this.selectDate(dayCell, dateStr));
            
            gridContainer.appendChild(dayCell);
        }
        
        calendarGrid.appendChild(gridContainer);
        
        // 更新日期状态显示
        this.updateDateStatusDisplay();
    }

    selectDate(dayCell, dateStr) {
        // 移除之前选中的状态
        const previouslySelected = document.querySelector('.calendar-day.selected');
        if (previouslySelected) {
            previouslySelected.classList.remove('selected');
        }
        
        // 设置当前选中
        dayCell.classList.add('selected');
        this.selectedDate = dateStr;
        
        // 更新选中日期信息
        const selectedDateInfo = document.getElementById('selectedDateInfo');
        const dateNoteInput = document.getElementById('dateNote');
        
        if (selectedDateInfo) {
            const dateObj = new Date(dateStr);
            const formattedDate = `${dateObj.getFullYear()}年${dateObj.getMonth() + 1}月${dateObj.getDate()}日`;
            selectedDateInfo.textContent = `已选择: ${formattedDate}`;
        }
        
        // 更新备注输入框
        if (dateNoteInput) {
            const event = this.userEvents[dateStr];
            dateNoteInput.value = event ? event.note || '' : '';
        }
        
        // 更新按钮状态
        this.updateButtonStates();
    }

    _updateCellSide(sideElement, event, sideName, statusTextMap) {
        if (!sideElement) return '';
        
        if (event) {
            sideElement.classList.add(event.status);
            return `${sideName}: ${statusTextMap[event.status] || event.status}`;
        } else {
            sideElement.classList.add('none');
            return `${sideName}: 未标记`;
        }
    }
    
    _updateMutualDateEffects(cell, dateStr, userEvent, partnerEvent, today) {
        const isMutualDate = userEvent && partnerEvent && 
                           userEvent.status === 'date' && partnerEvent.status === 'date';
        
        if (isMutualDate) {
            cell.classList.add('mutual-date');
            
            const cellDate = new Date(dateStr);
            cellDate.setHours(0, 0, 0, 0);
            const isTodayOrFuture = cellDate >= today;
            
            if (isTodayOrFuture) {
                cell.classList.add('mutual-date-future');
                cell.classList.add('breathe-effect');
                
                if (!cell.classList.contains('mutual-date-animated')) {
                    cell.classList.add('mutual-date-animated');
                    setTimeout(() => {
                        this.createHeartBubbles(cell);
                    }, 300);
                    
                    this.animatedDates.add(dateStr);
                }
                
                setTimeout(() => {
                    this.startDreamyBubbles(cell);
                }, 1000);
            }
        } else {
            cell.classList.remove('mutual-date');
            cell.classList.remove('mutual-date-animated');
        }
    }
    
    _updateCellNoteIndicator(cell, hasNote) {
        const existingNoteIndicator = cell.querySelector('.note-indicator');
        if (hasNote) {
            if (!existingNoteIndicator) {
                const noteIndicator = document.createElement('div');
                noteIndicator.className = 'note-indicator';
                cell.appendChild(noteIndicator);
            }
        } else if (existingNoteIndicator) {
            existingNoteIndicator.remove();
        }
    }
    
    _updateCellTooltipData(cell, tooltipText, partnerNote, selfNote, hasNote) {
        cell.dataset.tooltip = tooltipText || '未标记';
        cell.dataset.partnerNote = partnerNote;
        cell.dataset.selfNote = selfNote;
        cell.dataset.hasNote = hasNote ? 'true' : 'false';
        cell.removeAttribute('title');
        
        // 确保旧的指示器不显示
        const oldIndicator = cell.querySelector('.status-indicator, .partner-indicator');
        if (oldIndicator) {
            oldIndicator.style.display = 'none';
        }
    }
    
    updateDateStatusDisplay() {
        const dayCells = document.querySelectorAll('.calendar-day:not(.empty)');
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // 状态文本映射
        const statusTextMap = {
            busy: '忙碌',
            free: '空闲',
            date: '想约会'
        };
        
        dayCells.forEach(cell => {
            const dateStr = cell.dataset.date;
            const sidePartner = cell.querySelector('.side-partner');
            const sideSelf = cell.querySelector('.side-self');
            
            // 获取用户和伴侣的事件
            const userEvent = this.userEvents[dateStr];
            const partnerEvent = this.partnerEvents[dateStr];
            
            // 清空之前的样式
            cell.classList.remove('mutual-date', 'mutual-date-future', 'breathe-effect');
            if (sidePartner) sidePartner.className = 'side side-partner';
            if (sideSelf) sideSelf.className = 'side side-self';
            
            // 更新两侧状态并构建工具提示文本
            let tooltipText = '';
            let hasNote = false;
            const noteText = {
                partner: '',
                self: ''
            };
            
            // 更新伴侣侧
            if (sidePartner) {
                const partnerText = this._updateCellSide(sidePartner, partnerEvent, '伴侣', statusTextMap);
                tooltipText = partnerText;
                if (partnerEvent?.note?.trim()) {
                    noteText.partner = partnerEvent.note;
                    hasNote = true;
                }
            }
            
            // 更新用户侧
            if (sideSelf) {
                const selfText = this._updateCellSide(sideSelf, userEvent, '我', statusTextMap);
                tooltipText = tooltipText ? `${tooltipText} | ${selfText}` : selfText;
                if (userEvent?.note?.trim()) {
                    noteText.self = userEvent.note;
                    hasNote = true;
                }
            }
            
            // 更新双向约会效果
            this._updateMutualDateEffects(cell, dateStr, userEvent, partnerEvent, today);
            
            // 更新备注标记点
            this._updateCellNoteIndicator(cell, hasNote);
            
            // 更新工具提示数据
            this._updateCellTooltipData(cell, tooltipText, noteText.partner, noteText.self, hasNote);
        });
    }

    updateButtonStates() {
        // 可以在这里添加按钮状态更新逻辑
        // 例如：根据选中日期是否有事件来改变按钮样式
    }

    async updateDateStatus(status) {
        if (!this.selectedDate || !this.currentUser) return;
        
        if (status === 'clear') {
            // 删除事件
            await this.deleteEvent(this.selectedDate);
        } else {
            // 更新或创建事件
            await this.saveEvent(this.selectedDate, status);
        }
        
        // 重新加载数据并更新显示
        await this.loadCalendarData();
        await this.updateStats();
        
        // 检查是否达成双向约会并触发爱心效果
        if (status === 'date') {
            const userEvent = this.userEvents[this.selectedDate];
            const partnerEvent = this.partnerEvents[this.selectedDate];
            if (userEvent && partnerEvent && 
                userEvent.status === 'date' && partnerEvent.status === 'date') {
                // 延迟触发爱心效果，让用户能看到状态变化
                setTimeout(() => {
                    // 查找对应的单元格
                    const cell = document.querySelector(`.calendar-day[data-date="${this.selectedDate}"]`);
                    if (cell) {
                        this.createHeartBubbles(cell);
                    } else {
                        this.createHeartBubbles();
                    }
                }, 500);
            }
        }
    }

    async saveEvent(date, status = null, note = '') {
        try {
            const noteInput = document.getElementById('dateNote');
            const noteValue = note || (noteInput ? noteInput.value : '');
            
            // 如果没有提供状态，尝试从当前事件获取状态
            let finalStatus = status;
            if (!finalStatus) {
                const currentEvent = this.userEvents[date];
                finalStatus = currentEvent ? currentEvent.status : 'none';
            }
            
            const response = await fetch('/api/calendar/event', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    date: date,
                    status: finalStatus === 'none' ? null : finalStatus,
                    note: noteValue
                })
            });

            const data = await response.json();
            
            if (!data.success) {
                console.error('保存事件失败:', data.message);
            }
        } catch (error) {
            console.error('保存事件失败:', error);
        }
    }

    async deleteEvent(date) {
        try {
            const response = await fetch('/api/calendar/event', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ date: date })
            });

            const data = await response.json();
            
            if (!data.success) {
                console.error('删除事件失败:', data.message);
            }
        } catch (error) {
            console.error('删除事件失败:', error);
        }
    }

    async saveNote() {
        if (!this.selectedDate || !this.currentUser) return;
        
        const noteInput = document.getElementById('dateNote');
        const note = noteInput ? noteInput.value : '';
        
        // 获取当前状态，如果不存在则默认使用'free'
        const currentEvent = this.userEvents[this.selectedDate];
        const status = currentEvent ? currentEvent.status : 'free';
        
        await this.saveEvent(this.selectedDate, status, note);
        await this.loadCalendarData();
    }

    async loadCalendarData() {
        if (!this.currentUser) return;
        
        try {
            // 加载当前用户数据
            const userResponse = await fetch(`/api/calendar/${this.currentYear}/${this.currentMonth + 1}`);
            const userData = await userResponse.json();
            
            if (userData.success) {
                this.userEvents = userData.events || {};
            }
            
            // 加载伴侣数据
            const partnerResponse = await fetch(`/api/partner/events/${this.currentYear}/${this.currentMonth + 1}`);
            const partnerData = await partnerResponse.json();
            
            if (partnerData.success) {
                this.partnerEvents = partnerData.events || {};
            }
            
            // 更新日历显示
            this.updateDateStatusDisplay();
        } catch (error) {
            console.error('加载日历数据失败:', error);
        }
    }

    async updateStats() {
        if (!this.currentUser) return;
        
        try {
            const response = await fetch('/api/stats');
            const data = await response.json();
            
            if (data.success) {
                const stats = data.stats;
                
                // 更新统计数据
                const busyCount = document.getElementById('busyCount');
                const freeCount = document.getElementById('freeCount');
                const dateCount = document.getElementById('dateCount');
                const commonFreeCount = document.getElementById('commonFreeCount');
                
                if (busyCount) busyCount.textContent = stats.user_status_counts.busy || 0;
                if (freeCount) freeCount.textContent = stats.user_status_counts.free || 0;
                if (dateCount) dateCount.textContent = stats.user_status_counts.date || 0;
                if (commonFreeCount) commonFreeCount.textContent = stats.common_free_count || 0;
            }
        } catch (error) {
            console.error('更新统计数据失败:', error);
        }
    }

    // 初始化右键菜单
    initContextMenu() {
        // 获取右键菜单元素
        this.contextMenu = document.getElementById('contextMenu');
        if (!this.contextMenu) return;
        
        // 绑定右键点击事件到日历单元格
        document.addEventListener('contextmenu', (e) => {
            const calendarDay = e.target.closest('.calendar-day:not(.empty)');
            if (calendarDay && this.currentUser) {
                e.preventDefault();
                this.showContextMenu(e.clientX, e.clientY, calendarDay);
            }
        });
        
        // 点击页面其他地方关闭右键菜单
        document.addEventListener('click', (e) => {
            if (this.contextMenu.style.display === 'block' && 
                !this.contextMenu.contains(e.target) && 
                !e.target.closest('.calendar-day')) {
                this.contextMenu.style.display = 'none';
            }
        });
        
        // 绑定右键菜单项点击事件
        const menuItems = this.contextMenu.querySelectorAll('.context-menu-item');
        menuItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const status = item.getAttribute('data-status');
                if (this.selectedDate) {
                    if (item.id === 'addNoteMenuItem') {
                        // 添加备注功能
                        this.addNoteViaContextMenu();
                    } else {
                        this.updateDateStatus(status);
                    }
                    this.contextMenu.style.display = 'none';
                    
                    // 如果标记为想约会，检查是否双方都想约会
                    if (status === 'date') {
                        const userEvent = this.userEvents[this.selectedDate];
                        const partnerEvent = this.partnerEvents[this.selectedDate];
                        if (userEvent && partnerEvent && 
                            userEvent.status === 'date' && partnerEvent.status === 'date') {
                            // 查找对应的单元格
                            const cell = document.querySelector(`.calendar-day[data-date="${this.selectedDate}"]`);
                            if (cell) {
                                this.createHeartBubbles(cell);
                            }
                        }
                    }
                }
            });
        });
    }

    // 绑定备注模态框事件
    bindNoteModalEvents() {
        const noteModal = document.getElementById('noteModal');
        const noteInput = document.getElementById('noteInput');
        const statusOptionBtns = document.querySelectorAll('.status-option-btn');
        const saveNoteModalBtn = document.getElementById('saveNoteModalBtn');
        const cancelNoteModalBtn = document.getElementById('cancelNoteModalBtn');
        
        if (!noteModal || !saveNoteModalBtn) return;
        
        // 状态选项按钮事件
        statusOptionBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                // 移除所有按钮的active类
                statusOptionBtns.forEach(b => b.classList.remove('active'));
                // 给当前按钮添加active类
                btn.classList.add('active');
            });
        });
        
        // 保存按钮事件
        saveNoteModalBtn.addEventListener('click', async () => {
            if (!this.selectedDate || !this.currentUser) return;
            
            const note = noteInput ? noteInput.value.trim() : '';
            const activeStatusBtn = document.querySelector('.status-option-btn.active');
            const status = activeStatusBtn ? activeStatusBtn.getAttribute('data-status') : 'none';
            
            // 关闭模态框
            noteModal.style.display = 'none';
            
            // 保存备注
            await this.saveEvent(this.selectedDate, status, note);
            await this.loadCalendarData();
            
            // 更新日历显示
            this.updateDateStatusDisplay();
            
            // 清空输入框和重置状态
            if (noteInput) noteInput.value = '';
            statusOptionBtns.forEach(b => b.classList.remove('active'));
            
            // 如果选择的是无状态，显示提示
            if (status === 'none' && note) {
                console.log('无状态备注已保存:', note);
            }
        });
        
        // 取消按钮事件
        cancelNoteModalBtn?.addEventListener('click', () => {
            noteModal.style.display = 'none';
            if (noteInput) noteInput.value = '';
            statusOptionBtns.forEach(b => b.classList.remove('active'));
        });
        
        // 右键菜单中的添加备注项
        const addNoteMenuItem = document.getElementById('addNoteMenuItem');
        if (addNoteMenuItem) {
            addNoteMenuItem.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showNoteModal();
            });
        }
    }

    // 显示备注模态框
    showNoteModal() {
        if (!this.selectedDate || !this.currentUser) return;
        
        const noteModal = document.getElementById('noteModal');
        const noteInput = document.getElementById('noteInput');
        
        if (!noteModal || !noteInput) return;
        
        // 获取当前日期的现有备注和状态
        const currentEvent = this.userEvents[this.selectedDate];
        const statusOptionBtns = document.querySelectorAll('.status-option-btn');
        
        // 清空之前的选择
        statusOptionBtns.forEach(btn => btn.classList.remove('active'));
        
        if (currentEvent) {
            // 设置现有备注
            noteInput.value = currentEvent.note || '';
            
            // 设置当前状态（如果有）
            const currentStatus = currentEvent.status || 'none';
            const currentStatusBtn = document.querySelector(`.status-option-btn[data-status="${currentStatus}"]`);
            if (currentStatusBtn) {
                currentStatusBtn.classList.add('active');
            } else {
                // 如果没有匹配的状态，选择无状态
                const noneStatusBtn = document.querySelector('.status-option-btn[data-status="none"]');
                if (noneStatusBtn) noneStatusBtn.classList.add('active');
            }
        } else {
            // 没有现有事件，清空备注并选择无状态
            noteInput.value = '';
            const noneStatusBtn = document.querySelector('.status-option-btn[data-status="none"]');
            if (noneStatusBtn) noneStatusBtn.classList.add('active');
        }
        
        // 显示模态框
        noteModal.style.display = 'flex';
        noteInput.focus();
    }

    // 通过右键菜单添加备注（更新为使用模态框）
    addNoteViaContextMenu() {
        this.showNoteModal();
    }

    // 显示右键菜单
    showContextMenu(x, y, dayCell) {
        // 选择这个日期
        const dateStr = dayCell.dataset.date;
        this.selectDate(dayCell, dateStr);
        
        // 显示右键菜单
        this.contextMenu.style.display = 'block';
        
        // 定位菜单
        const menuWidth = this.contextMenu.offsetWidth;
        const menuHeight = this.contextMenu.offsetHeight;
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        
        // 确保菜单不超出窗口边界
        let posX = x;
        let posY = y;
        
        if (posX + menuWidth > windowWidth) {
            posX = windowWidth - menuWidth - 10;
        }
        
        if (posY + menuHeight > windowHeight) {
            posY = windowHeight - menuHeight - 10;
        }
        
        this.contextMenu.style.left = posX + 'px';
        this.contextMenu.style.top = posY + 'px';
    }

    // 创建爱心气泡动画（优化版，减少数量提高性能）
    createHeartBubbles(cell = null) {
        // 如果没有传入单元格，尝试使用选中的单元格
        const targetCell = cell || document.querySelector('.calendar-day.selected');
        if (!targetCell) return;
        
        const rect = targetCell.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        // 减少气泡数量：从8个减少到4个，提高性能
        for (let i = 0; i < 4; i++) {
            setTimeout(() => {
                this.createHeartBubble(centerX, centerY);
            }, i * 100); // 增加间隔时间，减少同时出现的元素数量
        }
    }

    // 创建单个爱心气泡
    createHeartBubble(x, y) {
        const heart = document.createElement('div');
        heart.className = 'heart-bubble';
        heart.innerHTML = '❤️';
        
        // 随机位置偏移，减少范围以提高视觉质量
        const randomX = (Math.random() - 0.5) * 40; // 从100减少到40
        const randomY = (Math.random() - 0.5) * 40;
        heart.style.setProperty('--tx', `${randomX}px`);
        heart.style.setProperty('--ty', `${randomY}px`);
        heart.style.left = x + 'px';
        heart.style.top = y + 'px';
        
        // 添加随机旋转效果
        const rotation = Math.random() * 360;
        heart.style.transform = `rotate(${rotation}deg)`;
        
        // 随机大小变化
        const size = 14 + Math.random() * 8; // 增加基础大小
        heart.style.fontSize = `${size}px`;
        
        document.body.appendChild(heart);
        
        // 动画结束后移除元素
        setTimeout(() => {
            if (heart.parentNode) {
                heart.parentNode.removeChild(heart);
            }
        }, 1800);
    }

    // 显示自定义工具提示
    showCustomTooltip(element, text) {
        if (!this.tooltip) {
            this.tooltip = document.getElementById('calendarTooltip');
            if (!this.tooltip) return;
        }
        
        // 清除之前的定时器
        if (this.tooltipTimer) {
            clearTimeout(this.tooltipTimer);
        }
        
        // 更新工具提示内容
        const [partnerText, selfText] = text.split(' | ');
        const partnerNote = element.dataset.partnerNote || '';
        const selfNote = element.dataset.selfNote || '';
        const hasNote = element.dataset.hasNote === 'true';
        
        const partnerElem = this.tooltip.querySelector('.calendar-tooltip-partner');
        const selfElem = this.tooltip.querySelector('.calendar-tooltip-self');
        const tooltipNotes = this.tooltip.querySelector('#calendarTooltipNotes');
        const partnerNoteContainer = this.tooltip.querySelector('.tooltip-note-partner');
        const selfNoteContainer = this.tooltip.querySelector('.tooltip-note-self');
        const partnerNoteText = this.tooltip.querySelector('#partnerNoteText');
        const selfNoteText = this.tooltip.querySelector('#selfNoteText');
        
        // 显示或隐藏备注区域
        if (tooltipNotes) {
            if (hasNote && (partnerNote || selfNote)) {
                this.tooltip.classList.add('has-notes');
                
                // 更新备注文本和显示状态
                if (partnerNote && partnerNote.trim()) {
                    partnerNoteContainer.style.display = 'flex';
                    if (partnerNoteText) {
                        partnerNoteText.textContent = partnerNote;
                    }
                } else {
                    partnerNoteContainer.style.display = 'none';
                }
                
                if (selfNote && selfNote.trim()) {
                    selfNoteContainer.style.display = 'flex';
                    if (selfNoteText) {
                        selfNoteText.textContent = selfNote;
                    }
                } else {
                    selfNoteContainer.style.display = 'none';
                }
            } else {
                this.tooltip.classList.remove('has-notes');
                if (partnerNoteContainer) partnerNoteContainer.style.display = 'none';
                if (selfNoteContainer) selfNoteContainer.style.display = 'none';
            }
        }
        
        if (partnerElem) {
            const partnerStatus = partnerElem.querySelector('.calendar-tooltip-status');
            const partnerTextSpan = partnerElem.querySelector('.tooltip-text-partner');
            
            if (partnerText) {
                partnerElem.style.display = 'flex';
                partnerTextSpan.textContent = partnerText;
                
                // 根据文本设置状态颜色
                if (partnerText.includes('忙碌')) {
                    partnerStatus.className = 'calendar-tooltip-status busy';
                } else if (partnerText.includes('空闲')) {
                    partnerStatus.className = 'calendar-tooltip-status free';
                } else if (partnerText.includes('想约会')) {
                    partnerStatus.className = 'calendar-tooltip-status date';
                } else {
                    partnerStatus.className = 'calendar-tooltip-status none';
                }
            } else {
                partnerElem.style.display = 'none';
            }
        }
        
        if (selfElem) {
            const selfStatus = selfElem.querySelector('.calendar-tooltip-status');
            const selfTextSpan = selfElem.querySelector('.tooltip-text-self');
            
            if (selfText) {
                selfElem.style.display = 'flex';
                selfTextSpan.textContent = selfText;
                
                // 根据文本设置状态颜色
                if (selfText.includes('忙碌')) {
                    selfStatus.className = 'calendar-tooltip-status busy';
                } else if (selfText.includes('空闲')) {
                    selfStatus.className = 'calendar-tooltip-status free';
                } else if (selfText.includes('想约会')) {
                    selfStatus.className = 'calendar-tooltip-status date';
                } else {
                    selfStatus.className = 'calendar-tooltip-status none';
                }
            } else {
                selfElem.style.display = 'none';
            }
        }
        
        // 计算位置
        const rect = element.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top;
        
        // 设置位置
        this.tooltip.style.left = x + 'px';
        this.tooltip.style.top = y + 'px';
        
        // 显示工具提示
        this.tooltip.classList.add('show');
        
        // 设置定时器自动隐藏
        this.tooltipTimer = setTimeout(() => {
            this.hideCustomTooltip();
        }, 3000);
    }

    // 隐藏自定义工具提示
    hideCustomTooltip() {
        if (this.tooltip) {
            this.tooltip.classList.remove('show');
            this.tooltip.classList.remove('has-notes');
        }
        if (this.tooltipTimer) {
            clearTimeout(this.tooltipTimer);
            this.tooltipTimer = null;
        }
    }

    // 启动梦幻气泡效果（优化版，减少气泡数量）
    startDreamyBubbles(cell) {
        if (!cell.classList.contains('mutual-date-future')) return;
        
        // 检查是否已经在运行动画，避免重复启动
        if (cell.dataset.bubblesRunning === 'true') {
            return;
        }
        
        // 标记气泡动画正在运行
        cell.dataset.bubblesRunning = 'true';
        
        // 清理之前可能存在的呼吸光晕层
        const existingGlow = cell.querySelector('.breathing-glow');
        if (existingGlow) {
            existingGlow.remove();
        }
        
        const rect = cell.getBoundingClientRect();
        const cellWidth = rect.width;
        const cellHeight = rect.height;
        
        // 创建呼吸光晕层
        const glowLayer = document.createElement('div');
        glowLayer.className = 'breathing-glow';
        glowLayer.style.position = 'absolute';
        glowLayer.style.top = '0';
        glowLayer.style.left = '0';
        glowLayer.style.width = '100%';
        glowLayer.style.height = '100%';
        glowLayer.style.borderRadius = '10px';
        glowLayer.style.pointerEvents = 'none';
        glowLayer.style.zIndex = '1';
        glowLayer.style.animation = 'breathe-glow 2s ease-in-out infinite';
        glowLayer.style.boxShadow = `
            0 0 15px rgba(255, 138, 0, 0.7),
            0 0 30px rgba(255, 138, 0, 0.5),
            inset 0 0 20px rgba(255, 138, 0, 0.3)
        `;
        
        cell.appendChild(glowLayer);
        
        // 气泡生成计数器，限制最多同时存在的气泡数量
        let activeBubbleCount = 0;
        const maxActiveBubbles = 3; // 最大同时存在的气泡数量
        
        // 气泡生成函数
        const createBubble = () => {
            // 检查是否仍然符合条件
            if (!cell.classList.contains('mutual-date-future')) {
                cell.dataset.bubblesRunning = 'false';
                return;
            }
            
            if (activeBubbleCount >= maxActiveBubbles) {
                // 即使达到最大气泡数，也继续调度下一次尝试
                setTimeout(createBubble, 1000); // 1秒后重试
                return;
            }
            
            activeBubbleCount++;
            
            const bubble = document.createElement('div');
            bubble.className = 'dream-bubble';
            bubble.textContent = '❤️';
            
            // 随机起始位置
            const startX = Math.random() * cellWidth;
            const startY = Math.random() * cellHeight;
            
            // 随机大小，稍微大一点以提高可见性
            const size = 14 + Math.random() * 6;
            bubble.style.fontSize = `${size}px`;
            
            // 随机颜色变体 - 更鲜艳的颜色
            const hue = 320 + Math.random() * 40; // 粉色系
            const saturation = 80 + Math.random() * 20; // 提高饱和度
            const lightness = 55 + Math.random() * 25; // 提高亮度
            bubble.style.color = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
            
            // 随机透明度 - 更明亮
            const opacity = 0.8 + Math.random() * 0.2;
            bubble.style.opacity = opacity.toString();
            
            // 随机动画延迟
            const delay = Math.random() * 1.5; // 减少最大延迟
            bubble.style.animationDelay = `${delay}s`;
            
            // 随机动画持续时间，更短一些
            const duration = 2.5 + Math.random() * 1.5;
            bubble.style.animationDuration = `${duration}s`;
            
            // 随机漂浮方向
            const driftX = (Math.random() - 0.5) * 30; // 减少漂浮范围
            bubble.style.setProperty('--drift-x', `${driftX}px`);
            
            // 设置初始位置
            bubble.style.left = `${startX}px`;
            bubble.style.top = `${startY}px`;
            
            // 添加到单元格
            cell.appendChild(bubble);
            
            // 动画结束后移除气泡
            setTimeout(() => {
                if (bubble.parentNode) {
                    bubble.parentNode.removeChild(bubble);
                }
                activeBubbleCount--;
            }, duration * 1000);
            
            // 计划下一个气泡，增加间隔时间
            const nextDelay = 500 + Math.random() * 1000; // 0.5-1.5秒间隔
            setTimeout(createBubble, nextDelay);
        };
        
        // 启动第一个气泡，延迟更长一些
        setTimeout(() => {
            createBubble();
        }, Math.random() * 1500);
        
        // 当单元格不再有 mutual-date-future 类时，清理标记
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (!cell.classList.contains('mutual-date-future')) {
                    cell.dataset.bubblesRunning = 'false';
                    observer.disconnect();
                }
            });
        });
        
        observer.observe(cell, { attributes: true, attributeFilter: ['class'] });
    }

    // 启动数据轮询，定期检查伴侣状态变化
    startPolling() {
        // 清除现有的轮询定时器
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
        }
        
        // 设置新的轮询定时器，每60秒轮询一次
        this.pollInterval = setInterval(() => {
            if (this.currentUser) {
                this.loadCalendarData();
            }
        }, 60000); // 60秒
    }

    // 停止数据轮询
    stopPolling() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
    }
}

// 页面加载完成后初始化应用
document.addEventListener('DOMContentLoaded', () => {
    window.calendarApp = new CalendarApp();
    
    // 为日历单元格添加鼠标悬停事件（委托到父元素）
    const calendarGrid = document.getElementById('calendarGrid');
    if (calendarGrid) {
        calendarGrid.addEventListener('mouseover', (e) => {
            const dayCell = e.target.closest('.calendar-day:not(.empty)');
            if (dayCell && window.calendarApp) {
                const tooltipText = dayCell.dataset.tooltip;
                if (tooltipText && tooltipText !== '未标记') {
                    window.calendarApp.showCustomTooltip(dayCell, tooltipText);
                }
            }
        });
        
        calendarGrid.addEventListener('mouseout', (e) => {
            if (window.calendarApp) {
                window.calendarApp.hideCustomTooltip();
            }
        });
        
        // 点击时隐藏工具提示
        calendarGrid.addEventListener('click', () => {
            if (window.calendarApp) {
                window.calendarApp.hideCustomTooltip();
            }
        });
    }
    
    // 全局点击事件隐藏右键菜单
    document.addEventListener('click', (e) => {
        const contextMenu = document.getElementById('contextMenu');
        if (contextMenu && contextMenu.style.display === 'block' && 
            !contextMenu.contains(e.target) && 
            !e.target.closest('.calendar-day')) {
            contextMenu.style.display = 'none';
        }
    });
});
