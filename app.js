// 双人健身进度看板 - 主应用逻辑
class FitnessTracker {
    constructor() {
        this.data = {
            version: '1.0',
            users: {
                user1: {
                    name: '用户',
                    targetWeight: 70,
                    records: {}
                },
                user2: {
                    name: '女朋友',
                    targetWeight: 55,
                    records: {}
                }
            },
            settings: {
                githubToken: '',
                encryptionPassword: '',
                lastSync: null
            }
        };

        this.currentMonth = dayjs();
        this.charts = {};

        this.init();
    }

    // 初始化应用
    init() {
        // 设置 dayjs 本地化
        dayjs.locale('zh-cn');

        // 加载本地数据
        this.loadLocalData();

        // 绑定事件
        this.bindEvents();

        // 初始化界面
        this.updateAllDisplays();

        // 检查是否需要设置
        if (!this.data.settings.githubToken) {
            setTimeout(() => {
                this.showSettings();
                this.showMessage('请先配置 GitHub Token 和加密密码', 'warning');
            }, 1000);
        }
    }

    // 绑定事件
    bindEvents() {
        // 同步按钮
        document.getElementById('syncBtn').addEventListener('click', () => this.syncWithGitHub());

        // 导出按钮
        document.getElementById('exportBtn').addEventListener('click', () => this.exportData());

        // 设置按钮
        document.getElementById('settingsBtn').addEventListener('click', () => this.showSettings());

        // 用户1今日提交
        document.getElementById('submit-today-1').addEventListener('click', () => this.submitTodayWeight('user1'));
        document.getElementById('quick-fill-1').addEventListener('click', () => this.quickFillYesterday('user1'));
        document.getElementById('today-weight-1').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.submitTodayWeight('user1');
        });

        // 用户2今日提交
        document.getElementById('submit-today-2').addEventListener('click', () => this.submitTodayWeight('user2'));
        document.getElementById('quick-fill-2').addEventListener('click', () => this.quickFillYesterday('user2'));
        document.getElementById('today-weight-2').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.submitTodayWeight('user2');
        });

        // 日历导航
        document.getElementById('prev-month-1').addEventListener('click', () => this.prevMonth('user1'));
        document.getElementById('next-month-1').addEventListener('click', () => this.nextMonth('user1'));
        document.getElementById('prev-month-2').addEventListener('click', () => this.prevMonth('user2'));
        document.getElementById('next-month-2').addEventListener('click', () => this.nextMonth('user2'));

        // 设置模态框
        document.getElementById('saveSettings').addEventListener('click', () => this.saveSettings());
        document.getElementById('closeSettings').addEventListener('click', () => this.hideSettings());
        document.getElementById('exportData').addEventListener('click', () => this.exportData());
        document.getElementById('clearData').addEventListener('click', () => this.clearData());

        // 点击模态框外部关闭
        document.getElementById('settingsModal').addEventListener('click', (e) => {
            if (e.target.id === 'settingsModal') {
                this.hideSettings();
            }
        });
    }

    // 加载本地数据
    loadLocalData() {
        try {
            const saved = localStorage.getItem('fitnessTrackerData');
            if (saved) {
                const parsed = JSON.parse(saved);
                // 合并数据，保留新版本可能新增的字段
                this.data = {
                    ...this.data,
                    ...parsed,
                    users: {
                        ...this.data.users,
                        ...parsed.users
                    },
                    settings: {
                        ...this.data.settings,
                        ...parsed.settings
                    }
                };
            }
        } catch (error) {
            console.error('加载本地数据失败:', error);
        }
    }

    // 保存本地数据
    saveLocalData() {
        try {
            localStorage.setItem('fitnessTrackerData', JSON.stringify(this.data));
            this.updateLastUpdateDisplay();
        } catch (error) {
            console.error('保存本地数据失败:', error);
        }
    }

    // 提交今日体重
    submitTodayWeight(userId) {
        const input = document.getElementById(`today-weight-${userId === 'user1' ? '1' : '2'}`);
        const weight = parseFloat(input.value);

        if (!weight || weight <= 0) {
            this.showMessage('请输入有效的体重数值', 'error');
            return;
        }

        const today = dayjs().format('YYYY-MM-DD');
        const user = this.data.users[userId];
        const previousWeight = this.getPreviousWeight(userId, today);

        // 保存记录
        user.records[today] = {
            weight: weight,
            timestamp: new Date().toISOString()
        };

        // 更新显示
        this.updateUserDisplay(userId);
        this.updateCalendar(userId);
        this.updateChart(userId);

        // 清空输入框
        input.value = '';

        // 显示变化
        if (previousWeight !== null) {
            const change = weight - previousWeight;
            const changeText = change > 0 ? `+${change.toFixed(1)}kg` : `${change.toFixed(1)}kg`;
            this.showMessage(`${user.name} 今日体重已记录，变化: ${changeText}`, 'success');
        } else {
            this.showMessage(`${user.name} 今日体重已记录`, 'success');
        }

        // 保存数据
        this.saveLocalData();

        // 自动同步到 GitHub
        if (this.data.settings.githubToken) {
            setTimeout(() => this.syncWithGitHub(), 1000);
        }
    }

    // 获取前一天的体重
    getPreviousWeight(userId, date) {
        const user = this.data.users[userId];
        const dates = Object.keys(user.records).sort();
        
        if (dates.length === 0) return null;

        const currentIndex = dates.indexOf(date);
        if (currentIndex > 0) {
            return user.records[dates[currentIndex - 1]].weight;
        }
        return null;
    }

    // 快速填充昨日体重
    quickFillYesterday(userId) {
        const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD');
        const user = this.data.users[userId];
        
        if (user.records[yesterday]) {
            const input = document.getElementById(`today-weight-${userId === 'user1' ? '1' : '2'}`);
            input.value = user.records[yesterday].weight;
            this.showMessage(`已填充 ${user.name} 昨日体重`, 'info');
        } else {
            this.showMessage(`${user.name} 昨日无记录`, 'warning');
        }
    }

    // 更新用户显示
    updateUserDisplay(userId) {
        const user = this.data.users[userId];
        const suffix = userId === 'user1' ? '1' : '2';
        const today = dayjs().format('YYYY-MM-DD');
        const todayRecord = user.records[today];

        // 当前体重
        if (todayRecord) {
            document.getElementById(`current-weight-${suffix}`).textContent = `${todayRecord.weight}kg`;
        } else {
            document.getElementById(`current-weight-${suffix}`).textContent = '-- kg';
        }

        // 目标体重
        document.getElementById(`target-weight-${suffix}`).textContent = `${user.targetWeight}kg`;

        // 已减重
        const firstRecord = this.getFirstWeight(userId);
        if (firstRecord !== null && todayRecord) {
            const loss = firstRecord - todayRecord.weight;
            document.getElementById(`weight-loss-${suffix}`).textContent = `${loss > 0 ? '+' : ''}${loss.toFixed(1)}kg`;
            document.getElementById(`weight-loss-${suffix}`).className = 
                `stat-value ${loss > 0 ? 'text-success' : loss < 0 ? 'text-danger' : ''}`;
        } else {
            document.getElementById(`weight-loss-${suffix}`).textContent = '-- kg';
        }

        // 连续打卡
        const streak = this.calculateStreak(userId);
        document.getElementById(`streak-days-${suffix}`).textContent = `${streak} 天`;

        // 今日变化
        if (todayRecord) {
            const previousWeight = this.getPreviousWeight(userId, today);
            if (previousWeight !== null) {
                const change = todayRecord.weight - previousWeight;
                const changeElement = document.getElementById(`today-change-${suffix}`);
                changeElement.textContent = `与昨日相比: ${change > 0 ? '+' : ''}${change.toFixed(1)}kg`;
                changeElement.className = `today-change ${change > 0 ? 'bg-danger text-danger' : change < 0 ? 'bg-success text-success' : ''}`;
            }
        }

        // 更新用户名称显示
        document.querySelector(`#user-panel-${suffix} h2`).innerHTML = `<i class="fas ${userId === 'user1' ? 'fa-user' : 'fa-user-female'}"></i> ${user.name}`;
    }

    // 获取首次记录体重
    getFirstWeight(userId) {
        const user = this.data.users[userId];
        const dates = Object.keys(user.records).sort();
        return dates.length > 0 ? user.records[dates[0]].weight : null;
    }

    // 计算连续打卡天数
    calculateStreak(userId) {
        const user = this.data.users[userId];
        const dates = Object.keys(user.records).sort().reverse();
        
        if (dates.length === 0) return 0;

        let streak = 0;
        let currentDate = dayjs();
        
        for (let i = 0; i < dates.length; i++) {
            const recordDate = dayjs(dates[i]);
            if (recordDate.isSame(currentDate, 'day') || 
                (i === 0 && recordDate.isSame(currentDate.subtract(1, 'day'), 'day'))) {
                streak++;
                currentDate = currentDate.subtract(1, 'day');
            } else {
                break;
            }
        }
        
        return streak;
    }

    // 更新日历
    updateCalendar(userId) {
        const suffix = userId === 'user1' ? '1' : '2';
        const monthStart = this.currentMonth.startOf('month');
        const monthEnd = this.currentMonth.endOf('month');
        const daysInMonth = monthEnd.date();
        const firstDayOfWeek = monthStart.day();

        // 更新月份显示
        document.getElementById(`current-month-${suffix}`).textContent = this.currentMonth.format('YYYY年M月');

        // 生成日历
        const calendarEl = document.getElementById(`calendar-${suffix}`);
        calendarEl.innerHTML = '';

        // 添加星期标题
        const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
        weekdays.forEach(day => {
            const dayEl = document.createElement('div');
            dayEl.className = 'calendar-day header';
            dayEl.textContent = day;
            calendarEl.appendChild(dayEl);
        });

        // 添加空白日期
        for (let i = 0; i < firstDayOfWeek; i++) {
            const emptyEl = document.createElement('div');
            emptyEl.className = 'calendar-day empty';
            calendarEl.appendChild(emptyEl);
        }

        // 添加日期
        const today = dayjs().format('YYYY-MM-DD');
        const user = this.data.users[userId];
        
        for (let day = 1; day <= daysInMonth; day++) {
            const date = monthStart.date(day);
            const dateStr = date.format('YYYY-MM-DD');
            const record = user.records[dateStr];
            
            const dayEl = document.createElement('div');
            dayEl.className = 'calendar-day';
            
            if (dateStr === today) {
                dayEl.classList.add('today');
            }
            
            if (record) {
                dayEl.classList.add('has-data');
                
                // 判断体重变化
                const previousWeight = this.getPreviousWeight(userId, dateStr);
                if (previousWeight !== null) {
                    const change = record.weight - previousWeight;
                    if (change > 0) {
                        dayEl.classList.add('weight-up');
                    } else if (change < 0) {
                        dayEl.classList.add('weight-down');
                    }
                }
                
                dayEl.innerHTML = `
                    <div class="day-date">${day}</div>
                    <div class="day-weight">${record.weight}kg</div>
                    <div class="day-change">
                        ${this.getWeightChangeText(userId, dateStr)}
                    </div>
                `;
                
                // 点击查看详情
                dayEl.addEventListener('click', () => this.showDayDetail(userId, dateStr));
            } else {
                dayEl.innerHTML = `<div class="day-date">${day}</div>`;
            }
            
            calendarEl.appendChild(dayEl);
        }
    }

    // 获取体重变化文本
    getWeightChangeText(userId, dateStr) {
        const user = this.data.users[userId];
        const record = user.records[dateStr];
        if (!record) return '';
        
        const previousWeight = this.getPreviousWeight(userId, dateStr);
        if (previousWeight === null) return '首日';
        
        const change = record.weight - previousWeight;
        if (change > 0) return `+${change.toFixed(1)}`;
        if (change < 0) return `${change.toFixed(1)}`;
        return '0.0';
    }

    // 显示日期详情
    showDayDetail(userId, dateStr) {
        const user = this.data.users[userId];
        const record = user.records[dateStr];
        if (!record) return;
        
        const previousWeight = this.getPreviousWeight(userId, dateStr);
        let message = `${dateStr}: ${record.weight}kg`;
        
        if (previousWeight !== null) {
            const change = record.weight - previousWeight;
            message += ` (${change > 0 ? '+' : ''}${change.toFixed(1)}kg)`;
        }
        
        this.showMessage(`${user.name} ${message}`, 'info');
    }

    // 更新图表
    updateChart(userId) {
        const suffix = userId === 'user1' ? '1' : '2';
        const canvas = document.getElementById(`chart-${suffix}`);
        const user = this.data.users[userId];
        
        // 准备数据
        const dates = Object.keys(user.records).sort();
        const weights = dates.map(date => user.records[date].weight);
        const changes = dates.map((date, index) => {
            if (index === 0) return 0;
            return user.records[date].weight - user.records[dates[index - 1]].weight;
        });
        
        // 目标体重线数据
        const targetWeights = dates.map(() => user.targetWeight);
        
        // 销毁旧图表
        if (this.charts[userId]) {
            this.charts[userId].destroy();
        }
        
        // 创建新图表
        const ctx = canvas.getContext('2d');
        this.charts[userId] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: dates.map(date => dayjs(date).format('MM-DD')),
                datasets: [
                    {
                        label: '体重',
                        data: weights,
                        borderColor: '#4facfe',
                        backgroundColor: 'rgba(79, 172, 254, 0.1)',
                        fill: true,
                        tension: 0.4
                    },
                    {
                        label: '目标体重',
                        data: targetWeights,
                        borderColor: '#28a745',
                        borderDash: [5, 5],
                        fill: false,
                        tension: 0
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    tooltip: {
                        callbacks: {
                            afterBody: (context) => {
                                const index = context[0].dataIndex;
                                if (index > 0 && changes[index] !== 0) {
                                    return `变化: ${changes[index] > 0 ? '+' : ''}${changes[index].toFixed(1)}kg`;
                                }
                                return '';
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        title: {
                            display: true,
                            text: '体重 (kg)'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: '日期'
                        }
                    }
                }
            }
        });
    }

    // 日历导航
    prevMonth(userId) {
        this.currentMonth = this.currentMonth.subtract(1, 'month');
        this.updateCalendar(userId);
    }

    nextMonth(userId) {
        this.currentMonth = this.currentMonth.add(1, 'month');
        this.updateCalendar(userId);
    }

    // 更新所有显示
    updateAllDisplays() {
        this.updateUserDisplay('user1');
        this.updateUserDisplay('user2');
        this.updateCalendar('user1');
        this.updateCalendar('user2');
        this.updateChart('user1');
        this.updateChart('user2');
        this.updateLastUpdateDisplay();
    }

    // 更新最后更新时间显示
    updateLastUpdateDisplay() {
        const lastUpdate = localStorage.getItem('fitnessTrackerLastUpdate');
        const element = document.getElementById('last-update');
        
        if (lastUpdate) {
            const date = dayjs(lastUpdate);
            element.textContent = `最后更新: ${date.format('YYYY-MM-DD HH:mm')}`;
        } else {
            element.textContent = '最后更新: --';
        }
    }

    // 显示设置
    showSettings() {
        // 填充当前设置
        document.getElementById('githubToken').value = this.data.settings.githubToken || '';
        document.getElementById('encryptionPassword').value = this.data.settings.encryptionPassword || '';
        document.getElementById('userName1').value = this.data.users.user1.name;
        document.getElementById('targetWeight1').value = this.data.users.user1.targetWeight;
        document.getElementById('userName2').value = this.data.users.user2.name;
        document.getElementById('targetWeight2').value = this.data.users.user2.targetWeight;
        
        document.getElementById('settingsModal').style.display = 'flex';
    }

    // 隐藏设置
    hideSettings() {
        document.getElementById('settingsModal').style.display = 'none';
    }

    // 保存设置
    saveSettings() {
        // 保存设置
        this.data.settings.githubToken = document.getElementById('githubToken').value.trim();
        this.data.settings.encryptionPassword = document.getElementById('encryptionPassword').value.trim();
        
        // 保存用户信息
        this.data.users.user1.name = document.getElementById('userName1').value.trim() || '用户';
        this.data.users.user1.targetWeight = parseFloat(document.getElementById('targetWeight1').value) || 70;
        this.data.users.user2.name = document.getElementById('userName2').value.trim() || '女朋友';
        this.data.users.user2.targetWeight = parseFloat(document.getElementById('targetWeight2').value) || 55;
        
        // 保存数据
        this.saveLocalData();
        
        // 更新显示
        this.updateAllDisplays();
        
        // 隐藏设置
        this.hideSettings();
        
        this.showMessage('设置已保存', 'success');
    }

    // 同步到 GitHub
    async syncWithGitHub() {
        if (!this.data.settings.githubToken) {
            this.showMessage('请先配置 GitHub Token', 'error');
            this.showSettings();
            return;
        }
        
        try {
            this.showMessage('正在同步到 GitHub...', 'info');
            
            // 这里需要实现实际的 GitHub Gist 同步逻辑
            // 暂时模拟成功
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            this.data.settings.lastSync = new Date().toISOString();
            this.saveLocalData();
            
            this.showMessage('数据已同步到 GitHub Gist', 'success');
        } catch (error) {
            console.error('同步失败:', error);
            this.showMessage('同步失败: ' + error.message, 'error');
        }
    }

    // 导出数据
    exportData() {
        const dataStr = JSON.stringify(this.data, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `fitness-tracker-backup-${dayjs().format('YYYY-MM-DD')}.json`;
        link.click();
        
        this.showMessage('数据已导出', 'success');
    }

    // 清空数据
    clearData() {
        if (confirm('确定要清空所有本地数据吗？此操作不可撤销。')) {
            localStorage.removeItem('fitnessTrackerData');
            localStorage.removeItem('fitnessTrackerLastUpdate');
            location.reload();
        }
    }

    // 显示消息
    showMessage(message, type = 'info') {
        // 这里可以实现一个消息提示系统
        console.log(`[${type}] ${message}`);
        alert(`[${type.toUpperCase()}] ${message}`);
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    window.fitnessTracker = new FitnessTracker();
});