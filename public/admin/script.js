let authToken = '';
let refreshInterval = null;

function login() {
    const password = document.getElementById('password').value;
    if (!password) {
        showLoginError('请输入密码');
        return;
    }
    
    authToken = password;
    testAuth();
}

function testAuth() {
    fetch('/admin/status', {
        headers: {
            'Authorization': `Bearer ${authToken}`
        }
    })
    .then(response => {
        if (response.ok) {
            document.getElementById('loginForm').style.display = 'none';
            document.getElementById('dashboard').style.display = 'block';
            bindDashboardEvents();
            loadAllData();
            startAutoRefresh();
            saveToken(); // 保存token到localStorage
        } else {
            showLoginError('密码错误');
        }
    })
    .catch(error => {
        showLoginError('连接失败: ' + error.message);
    });
}

function showLoginError(message) {
    const errorDiv = document.getElementById('loginError');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
}

function logout() {
    authToken = '';
    clearInterval(refreshInterval);
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('dashboard').style.display = 'none';
    document.getElementById('password').value = '';
}

function startAutoRefresh() {
    clearInterval(refreshInterval);
    refreshInterval = setInterval(loadStats, 30000); // 30秒刷新
}

function loadAllData() {
    loadStats();
    loadRecentRequests();
    loadConfig();
    loadAdminLogs();
}

function loadStats() {
    fetch('/admin/stats', {
        headers: {
            'Authorization': `Bearer ${authToken}`
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            updateOverviewStats(data.stats);
            updateProviderStats(data.stats);
            updateLastUpdate();
        }
    })
    .catch(error => console.error('加载统计失败:', error));
}

function updateOverviewStats(stats) {
    const overall = stats.overall;
    const container = document.getElementById('overviewStats');
    
    const successRate = overall.total_requests > 0 
        ? ((overall.successful_requests / overall.total_requests) * 100).toFixed(1)
        : 0;
    
    container.innerHTML = `
        <div class="stat-card">
            <h3>总请求数</h3>
            <div class="stat-value">${overall.total_requests || 0}</div>
            <div class="stat-sub">24小时内</div>
        </div>
        <div class="stat-card">
            <h3>成功率</h3>
            <div class="stat-value ${successRate >= 95 ? 'success' : successRate >= 80 ? 'warning' : 'error'}">
                ${successRate}%
            </div>
            <div class="stat-sub">${overall.successful_requests || 0} / ${overall.total_requests || 0}</div>
        </div>
        <div class="stat-card">
            <h3>平均响应时间</h3>
            <div class="stat-value">${(overall.avg_response_time || 0).toFixed(0)}ms</div>
            <div class="stat-sub">毫秒</div>
        </div>
        <div class="stat-card">
            <h3>总Token数</h3>
            <div class="stat-value">${overall.total_tokens || 0}</div>
            <div class="stat-sub">24小时内</div>
        </div>
    `;
}

function updateProviderStats(stats) {
    const tbody = document.querySelector('#providerStats tbody');
    tbody.innerHTML = '';
    
    stats.byProvider.forEach(provider => {
        const successRate = provider.total_requests > 0 
            ? ((provider.successful_requests / provider.total_requests) * 100).toFixed(1)
            : 0;
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${provider.provider}</td>
            <td>${provider.total_requests}</td>
            <td>${provider.successful_requests}</td>
            <td class="${successRate >= 95 ? 'success' : successRate >= 80 ? 'warning' : 'error'}">
                ${successRate}%
            </td>
            <td>${(provider.avg_response_time || 0).toFixed(0)}ms</td>
            <td>${provider.total_tokens || 0}</td>
        `;
        tbody.appendChild(row);
    });
}

function loadRecentRequests() {
    fetch('/admin/requests?limit=50', {
        headers: {
            'Authorization': `Bearer ${authToken}`
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            updateRecentRequests(data.requests);
        }
    })
    .catch(error => console.error('加载最近请求失败:', error));
}

function updateRecentRequests(requests) {
    const tbody = document.querySelector('#recentRequests tbody');
    tbody.innerHTML = '';
    
    requests.forEach(req => {
        const time = new Date(req.timestamp).toLocaleString('zh-CN');
        const status = req.success ? 
            '<span class="success">成功</span>' : 
            `<span class="error">失败</span>`;
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${time}</td>
            <td>${req.model}</td>
            <td>${req.provider}</td>
            <td>${status}</td>
            <td>${req.response_time || 0}ms</td>
            <td>${req.tokens_used || 0}</td>
        `;
        tbody.appendChild(row);
    });
}

function loadConfig() {
    fetch('/admin/config', {
        headers: {
            'Authorization': `Bearer ${authToken}`
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            document.getElementById('configEditor').value = 
                JSON.stringify(data.config, null, 2);
        }
    })
    .catch(error => console.error('加载配置失败:', error));
}

function saveConfig() {
    const configText = document.getElementById('configEditor').value;
    
    let parsedConfig;
    try {
        parsedConfig = JSON.parse(configText);
    } catch (e) {
        alert('配置格式错误: ' + e.message);
        return;
    }
    
    if (!confirm('确定要保存配置吗？这将会覆盖 local.json 文件并重启服务。')) {
        return;
    }
    
    fetch('/admin/save-config', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ config: parsedConfig })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('配置保存成功');
            loadAllData();
        } else {
            alert('配置保存失败: ' + data.error);
        }
    })
    .catch(error => {
        alert('保存失败: ' + error.message);
    });
}

function reloadConfig() {
    if (!confirm('确定要重载配置文件吗？这将会从磁盘重新加载配置。')) {
        return;
    }
    
    fetch('/admin/reload-config', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${authToken}`
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('配置重载成功');
            loadAllData(); // 重新加载所有数据
        } else {
            alert('配置重载失败: ' + data.error);
        }
    })
    .catch(error => {
        alert('操作失败: ' + error.message);
    });
}

function updateHourlyStats() {
    fetch('/admin/update-hourly-stats', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${authToken}`
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert(`小时统计已更新，更新了 ${data.updated} 条记录`);
            loadAllData(); // 更新所有数据，包括最近请求
        } else {
            alert('更新失败: ' + data.error);
        }
    })
    .catch(error => {
        alert('操作失败: ' + error.message);
    });
}

function cleanupData() {
    if (!confirm('确定要清理30天前的数据吗？此操作不可恢复。')) {
        return;
    }
    
    fetch('/admin/cleanup', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${authToken}`
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert(`数据清理完成: ${JSON.stringify(data.result)}`);
            loadAllData();
        } else {
            alert('清理失败: ' + data.error);
        }
    })
    .catch(error => {
        alert('操作失败: ' + error.message);
    });
}

function loadAdminLogs() {
    fetch('/admin/logs?limit=100', {
        headers: {
            'Authorization': `Bearer ${authToken}`
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            updateAdminLogs(data.logs);
        }
    })
    .catch(error => console.error('加载日志失败:', error));
}

function updateAdminLogs(logs) {
    const tbody = document.querySelector('#adminLogs tbody');
    tbody.innerHTML = '';
    
    logs.forEach(log => {
        const time = new Date(log.timestamp).toLocaleString('zh-CN');
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${time}</td>
            <td>${log.action}</td>
            <td>${log.details || ''}</td>
            <td>${log.ip_address || ''}</td>
        `;
        tbody.appendChild(row);
    });
}

function updateLastUpdate() {
    const now = new Date();
    document.getElementById('lastUpdate').textContent = 
        `最后更新: ${now.toLocaleString('zh-CN')}`;
}

// 绑定dashboard按钮事件
function bindDashboardEvents() {
    document.getElementById('refreshStatsBtn').addEventListener('click', loadStats);
    document.getElementById('reloadConfigBtn').addEventListener('click', reloadConfig);
    document.getElementById('updateStatsBtn').addEventListener('click', updateHourlyStats);
    document.getElementById('cleanupDataBtn').addEventListener('click', cleanupData);
    document.getElementById('logoutBtn').addEventListener('click', logout);
    document.getElementById('saveConfigBtn').addEventListener('click', saveConfig);
    document.getElementById('loadConfigBtn').addEventListener('click', loadConfig);
}

// 页面加载时检查是否有保存的token
document.addEventListener('DOMContentLoaded', function() {
    const savedToken = localStorage.getItem('adminToken');
    if (savedToken) {
        authToken = savedToken;
        testAuth();
    }
    
    // 登录按钮点击事件
    document.getElementById('loginButton').addEventListener('click', login);
    
    // 密码输入框回车登录
    document.getElementById('password').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            login();
        }
    });
});

// 登录成功时保存token
function saveToken() {
    localStorage.setItem('adminToken', authToken);
}