// ═══════════════════════════════════════════════════
// 🛡️ ADMIN DASHBOARD - JavaScript
// ═══════════════════════════════════════════════════

const token = localStorage.getItem('jwt_token');
const userInfo = JSON.parse(localStorage.getItem('user_info') || '{}');
const username = userInfo.username;
const role = userInfo.role;

// Check admin access
if (!token || role !== 'ADMIN') {
    window.location.href = 'home.html';
}

// DOM Elements
const adminUsername = document.getElementById('adminUsername');
const refreshBtn = document.getElementById('refreshStats');
const userSearch = document.getElementById('userSearch');

// Set admin name
if (adminUsername) {
    adminUsername.textContent = username;
}

// View switching
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
        const view = item.dataset.view;
        if (!view) return;

        switchView(view);
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        item.classList.add('active');
    });
});

function switchView(view) {
    document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));

    if (view === 'dashboard') {
        document.getElementById('dashboardView').classList.add('active');
        loadStats();
    } else if (view === 'users') {
        document.getElementById('usersView').classList.add('active');
        loadUsers();
    } else if (view === 'messages') {
        document.getElementById('messagesView').classList.add('active');
    }
}

// ═══════════════════════════════════════════════════
// 📊 STATS & CHARTS
// ═══════════════════════════════════════════════════

let activityChart = null;

async function loadStats() {
    try {
        const response = await fetch('/api/admin/stats', {
            headers: { 'Authorization': 'Bearer ' + token }
        });

        if (response.ok) {
            const stats = await response.json();

            // Animate counters
            animateCounter('totalUsers', stats.totalUsers);
            animateCounter('totalMessages', stats.totalMessages);
            animateCounter('onlineUsers', stats.onlineUsers);
            animateCounter('messagesToday', stats.messagesToday);
            animateCounter('bannedUsers', stats.bannedUsers);

            // Format storage
            const storageMB = (stats.storageUsed / (1024 * 1024)).toFixed(2);
            document.getElementById('storageUsed').textContent = storageMB + ' MB';
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }

    loadActivityChart();
}

function animateCounter(id, target) {
    const el = document.getElementById(id);
    if (!el) return;

    let current = 0;
    const increment = Math.ceil(target / 30);
    const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
            current = target;
            clearInterval(timer);
        }
        el.textContent = current.toLocaleString();
    }, 30);
}

async function loadActivityChart() {
    try {
        const response = await fetch('/api/admin/stats/activity', {
            headers: { 'Authorization': 'Bearer ' + token }
        });

        if (response.ok) {
            const data = await response.json();

            const labels = data.map(d => {
                const date = new Date(d.date);
                return date.toLocaleDateString('en-US', { weekday: 'short' });
            });
            const counts = data.map(d => d.count);

            const ctx = document.getElementById('activityChart').getContext('2d');

            if (activityChart) {
                activityChart.destroy();
            }

            activityChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Messages',
                        data: counts,
                        borderColor: '#FF4444',
                        backgroundColor: 'rgba(255, 68, 68, 0.1)',
                        fill: true,
                        tension: 0.4,
                        pointBackgroundColor: '#FFD700',
                        pointBorderColor: '#FFD700',
                        pointRadius: 6,
                        pointHoverRadius: 8
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: { color: 'rgba(255, 255, 255, 0.05)' },
                            ticks: { color: '#606070' }
                        },
                        x: {
                            grid: { display: false },
                            ticks: { color: '#606070' }
                        }
                    }
                }
            });
        }
    } catch (error) {
        console.error('Error loading activity:', error);
    }
}

// ═══════════════════════════════════════════════════
// 👥 USER MANAGEMENT
// ═══════════════════════════════════════════════════

let allUsers = [];

async function loadUsers() {
    try {
        const response = await fetch('/api/admin/users', {
            headers: { 'Authorization': 'Bearer ' + token }
        });

        if (response.ok) {
            allUsers = await response.json();
            renderUsers(allUsers);
        }
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

function renderUsers(users) {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;

    tbody.innerHTML = users.map(user => {
        const avatarUrl = `https://api.dicebear.com/7.x/initials/svg?seed=${user.username}`;
        const roleClass = user.role.toLowerCase();

        let statusClass = 'offline';
        let statusText = 'Offline';
        if (user.isBanned) {
            statusClass = 'banned';
            statusText = 'Banned';
        } else if (user.isOnline) {
            statusClass = 'online';
            statusText = 'Online';
        }

        let actions = '';
        if (user.role !== 'ADMIN') {
            if (user.isBanned) {
                actions += `<button class="action-btn unban" onclick="unbanUser(${user.id})">Unban</button>`;
            } else {
                actions += `<button class="action-btn ban" onclick="banUser(${user.id})">Ban</button>`;
            }

            if (user.role === 'USER') {
                actions += `<button class="action-btn promote" onclick="promoteUser(${user.id})">Promote</button>`;
            } else if (user.role === 'MODERATOR') {
                actions += `<button class="action-btn promote" onclick="demoteUser(${user.id})">Demote</button>`;
            }
        }
        actions += `<button class="action-btn spy" onclick="spyUser(${user.id}, '${user.username}')">Spy</button>`;

        return `
            <tr>
                <td>
                    <div class="user-cell">
                        <img src="${avatarUrl}" class="user-avatar" alt="">
                        <span class="user-name">${user.username}</span>
                    </div>
                </td>
                <td>${user.email}</td>
                <td><span class="role-badge ${roleClass}">${user.role}</span></td>
                <td><span class="status-badge ${statusClass}"><i class="fas fa-circle"></i> ${statusText}</span></td>
                <td>${user.messageCount || 0}</td>
                <td>${actions}</td>
            </tr>
        `;
    }).join('');
}

// User search
if (userSearch) {
    userSearch.addEventListener('input', () => {
        const query = userSearch.value.toLowerCase();
        const filtered = allUsers.filter(u =>
            u.username.toLowerCase().includes(query) ||
            u.email.toLowerCase().includes(query)
        );
        renderUsers(filtered);
    });
}

// User actions
async function banUser(id) {
    if (!confirm('Are you sure you want to ban this user?')) return;

    try {
        const response = await fetch(`/api/admin/users/${id}/ban`, {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token }
        });

        if (response.ok) {
            showNotification('User banned successfully');
            loadUsers();
        } else {
            const error = await response.json();
            showNotification(error.message || 'Failed to ban user');
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

async function unbanUser(id) {
    try {
        const response = await fetch(`/api/admin/users/${id}/unban`, {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token }
        });

        if (response.ok) {
            showNotification('User unbanned successfully');
            loadUsers();
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

async function promoteUser(id) {
    try {
        const response = await fetch(`/api/admin/users/${id}/promote`, {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token }
        });

        if (response.ok) {
            showNotification('User promoted to Moderator');
            loadUsers();
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

async function demoteUser(id) {
    try {
        const response = await fetch(`/api/admin/users/${id}/demote`, {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token }
        });

        if (response.ok) {
            showNotification('User demoted to regular user');
            loadUsers();
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

// ═══════════════════════════════════════════════════
// 🕵️ SPY MODE
// ═══════════════════════════════════════════════════

async function spyUser(id, targetUsername) {
    switchView('messages');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelector('[data-view="messages"]').classList.add('active');

    const container = document.getElementById('spyContainer');
    container.innerHTML = `
        <div class="spy-header">
            <img src="https://api.dicebear.com/7.x/initials/svg?seed=${targetUsername}" alt="">
            <div>
                <h3>${targetUsername}</h3>
                <p>Message History</p>
            </div>
        </div>
        <div class="spy-messages" id="spyMessages">
            <p style="text-align: center; color: #606070;">Loading messages...</p>
        </div>
    `;

    try {
        const response = await fetch(`/api/admin/users/${id}/messages`, {
            headers: { 'Authorization': 'Bearer ' + token }
        });

        if (response.ok) {
            const messages = await response.json();

            const messagesContainer = document.getElementById('spyMessages');

            if (messages.length === 0) {
                messagesContainer.innerHTML = '<p style="text-align: center; color: #606070;">No messages found</p>';
                return;
            }

            messagesContainer.innerHTML = messages.map(msg => `
                <div class="spy-message">
                    <div class="spy-message-time">${new Date(msg.timestamp).toLocaleString()}</div>
                    <div class="spy-message-content">${msg.content}</div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading messages:', error);
    }
}

// ═══════════════════════════════════════════════════
// 🔔 NOTIFICATIONS
// ═══════════════════════════════════════════════════

function showNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #FF4444, #CC0000);
        color: white;
        padding: 16px 24px;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(255, 68, 68, 0.4);
        z-index: 10000;
        font-weight: 500;
        animation: slideIn 0.3s ease;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Add animation styles
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(400px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(400px); opacity: 0; }
    }
`;
document.head.appendChild(style);

// ═══════════════════════════════════════════════════
// 🚀 INITIALIZATION
// ═══════════════════════════════════════════════════

if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
        loadStats();
        showNotification('Stats refreshed!');
    });
}

// Load initial data
loadStats();
