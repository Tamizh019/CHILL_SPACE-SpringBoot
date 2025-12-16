'use strict';
// ═══════════════════════════════════════════════════
// 🔧 GLOBAL VARIABLES
// ═══════════════════════════════════════════════════
let stompClient = null;
let username = null;
let userId = null;
let userRole = null;
let token = null;
let onlineUsers = new Set();
let allUsersCache = [];
let lastDisplayedDate = null;

// DOM Elements (Updated for new HTML structure)
const chatInput = document.getElementById('chatInput');
const chatMessages = document.getElementById('chatMessages');
const sendBtn = document.getElementById('sendBtn');
const charCount = document.getElementById('charCount');
const onlineMembersList = document.getElementById('onlineMembersList');
const offlineMembersList = document.getElementById('offlineMembersList');
const onlineCountDisplay = document.getElementById('onlineCount');
const onlineCountSidebar = document.getElementById('onlineCountSidebar');
const totalMembersDisplay = document.getElementById('totalMembers');
const offlineCountDisplay = document.getElementById('offlineCount');
const logoutBtn = document.getElementById('logoutBtn');
const profileModal = document.getElementById('profileModal');
const modalClose = document.getElementById('closeModalBtn');
const sidebarUsername = document.getElementById('sidebarUsername'); // New
const sidebarAvatar = document.getElementById('sidebarAvatar'); // New

// ═══════════════════════════════════════════════════
// 🚀 INITIALIZATION
// ═══════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    setupUIEnhancements();
    setupSettings(); // Initialize settings listeners
});

function initializeApp() {
    const userInfo = JSON.parse(localStorage.getItem('user_info'));
    token = localStorage.getItem('jwt_token');

    if (!userInfo || !token) {
        console.error('❌ No user info or token found');
        window.location.href = 'index.html';
        return;
    }

    username = userInfo.username;
    userId = userInfo.id;

    const decoded = parseJwt(token);
    userRole = decoded.role || 'USER';

    console.log('✅ User authenticated:', username, '| Role:', userRole);

    setupEventListeners();
    connectWebSocket();

    // IMPORTANT: Load users FIRST so avatar cache is populated before chat history
    loadAllUsers().then(() => {
        loadChatHistory();
    });
}

// ═══════════════════════════════════════════════════
// 🎨 UI ENHANCEMENTS
// ═══════════════════════════════════════════════════
function setupUIEnhancements() {
    // User Dropdown Toggle
    document.getElementById('userProfileBtn')?.addEventListener('click', function (e) {
        e.stopPropagation();
        document.getElementById('userDropdown')?.classList.toggle('show');
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', function (e) {
        if (!e.target.closest('.sidebar-footer')) {
            document.getElementById('userDropdown')?.classList.remove('show');
        }
    });

    // Profile Button
    document.getElementById('profileBtn')?.addEventListener('click', function (e) {
        e.preventDefault();
        openEditProfileModal();
    });

    // Toggle Members Panel on Mobile
    document.getElementById('toggleMembersBtn')?.addEventListener('click', function () {
        document.getElementById('membersPanel')?.classList.toggle('open');
    });

    // Nav item switching (View Logic)
    const navItems = document.querySelectorAll('.nav-item');
    const views = {
        'chat': document.querySelector('.main-content'),
        'files': document.getElementById('filesSection'),
        'ai': document.getElementById('aiSection'),
        'settings': document.getElementById('settingsSection')
    };

    navItems.forEach(item => {
        item.addEventListener('click', function (e) {
            const viewId = this.dataset.view;

            // If no data-view attribute, let it navigate normally (e.g., Admin Panel link)
            if (!viewId) {
                return; // Don't prevent default - allow link to work
            }

            e.preventDefault();

            // 1. Update Active State
            navItems.forEach(i => i.classList.remove('active'));
            this.classList.add('active');

            // 2. Hide all views
            Object.values(views).forEach(el => {
                if (el) el.style.display = 'none';
            });

            // 3. Show selected view
            if (views[viewId]) {
                views[viewId].style.display = 'flex';

                // Specific init logic
                if (viewId === 'chat') {
                    const chatMsgs = document.getElementById('chatMessages');
                    if (chatMsgs) chatMsgs.scrollTop = chatMsgs.scrollHeight;
                }

                if (viewId === 'settings') {
                    // Refresh settings UI when opened
                    document.getElementById('settingsUsername').value = username;
                }
            }
        });
    });
}

// ═══════════════════════════════════════════════════
// ⚙️ SETTINGS LOGIC
// ═══════════════════════════════════════════════════
function setupSettings() {
    // 1. Theme Configuration
    const themeBtns = document.querySelectorAll('.theme-btn');

    // Load saved theme
    const savedTheme = localStorage.getItem('app_theme') || 'glass';
    applyTheme(savedTheme);

    themeBtns.forEach(btn => {
        if (btn.dataset.theme === savedTheme) btn.classList.add('active');

        btn.addEventListener('click', () => {
            const theme = btn.dataset.theme;
            applyTheme(theme);

            // Update UI
            themeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Save preference
            localStorage.setItem('app_theme', theme);
            showNotification(`Theme changed to ${theme.charAt(0).toUpperCase() + theme.slice(1)}`, 'info');
        });
    });

    // 2. Notifications
    const soundToggle = document.getElementById('soundToggle');
    const notifyToggle = document.getElementById('notifyToggle');

    // Load preferences
    const prefs = JSON.parse(localStorage.getItem('user_prefs') || '{"sound": true, "notify": false}');
    if (soundToggle) soundToggle.checked = prefs.sound;
    if (notifyToggle) notifyToggle.checked = prefs.notify;

    soundToggle?.addEventListener('change', (e) => {
        prefs.sound = e.target.checked;
        savePrefs(prefs);
    });

    notifyToggle?.addEventListener('change', (e) => {
        prefs.notify = e.target.checked;
        savePrefs(prefs);
        if (prefs.notify && Notification.permission !== 'granted') {
            Notification.requestPermission();
        }
    });

    // 3. Profile Settings
    const saveUsernameBtn = document.getElementById('saveUsernameBtn');
    if (saveUsernameBtn) {
        saveUsernameBtn.addEventListener('click', () => {
            const newName = document.getElementById('settingsUsername').value.trim();
            if (newName && newName !== username) {
                updateProfile(newName);
            } else if (!newName) {
                showNotification('Username cannot be empty', 'error');
            }
        });
    }

    const settingsAvatarInput = document.getElementById('settingsAvatarInput');
    if (settingsAvatarInput) {
        settingsAvatarInput.addEventListener('change', handleAvatarUpload);
    }

    // 4. Logout
    const settingsLogoutBtn = document.getElementById('settingsLogoutBtn');
    if (settingsLogoutBtn) {
        settingsLogoutBtn.addEventListener('click', handleLogout);
    }
}

function savePrefs(prefs) {
    localStorage.setItem('user_prefs', JSON.stringify(prefs));
}

function applyTheme(theme) {
    const root = document.documentElement;
    // Default (Glass)
    let colors = {
        primary: '#7000ff',
        secondary: '#00f0ff',
        bgPrimary: '#08080c'
    };

    if (theme === 'midnight') {
        colors = {
            primary: '#3b82f6',
            secondary: '#A855F7',
            bgPrimary: '#000000'
        };
    } else if (theme === 'sunset') {
        colors = {
            primary: '#F43F5E',
            secondary: '#F59E0B',
            bgPrimary: '#2c0b1e'
        };
    } else if (theme === 'neon') {
        colors = {
            primary: '#00ff00',
            secondary: '#00ffff',
            bgPrimary: '#000000'
        };
    } else if (theme === 'forest') {
        colors = {
            primary: '#10B981',
            secondary: '#34D399',
            bgPrimary: '#022c22'
        };
    } else if (theme === 'royal') {
        colors = {
            primary: '#C084FC',
            secondary: '#FFD700',
            bgPrimary: '#171725'
        };
    }

    root.style.setProperty('--primary', colors.primary);
    root.style.setProperty('--secondary', colors.secondary);
    root.style.setProperty('--bg-primary', colors.bgPrimary);
}

// Re-using existing profile update logic but adapted
function updateProfile(newName) {
    fetch('/api/users/profile', {
        method: 'PUT',
        headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username: newName }) // Only sending username
    })
        .then(res => res.json())
        .then(data => {
            if (data.usernameChanged) {
                showNotification('Username updated! logging out...', 'success');
                setTimeout(() => handleLogout(), 1500);
            } else {
                // Should not happen if we only change username to a unique one
                showNotification('Failed to update username', 'error');
            }
        })
        .catch(err => {
            console.error(err);
            showNotification('Update failed. Username might be taken.', 'error');
        });
}

function handleLogout() {
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('user_info');
    window.location.href = 'index.html';
}

// ═══════════════════════════════════════════════════
// 🔐 AUTHENTICATION HELPERS
// ═══════════════════════════════════════════════════
function parseJwt(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
            atob(base64).split('').map(c => {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join('')
        );
        return JSON.parse(jsonPayload);
    } catch (e) {
        console.error('Failed to parse JWT:', e);
        return {};
    }
}

function getAvatarUrl(targetUsername) {
    const userInfo = allUsersCache.find(u => u.username === targetUsername);
    if (userInfo?.hasProfileImage) {
        return `/api/users/${targetUsername}/avatar?t=${Date.now()}`;
    }
    // Default fallback to local asset
    return 'Assets/pfp2.jpg';
}

function updateUserUI() {
    // Update sidebar avatar and username
    if (sidebarAvatar) {
        sidebarAvatar.src = getAvatarUrl(username);
    }
    if (sidebarUsername) {
        sidebarUsername.textContent = username;
    }

    // Update user status
    const userStatus = document.getElementById('userStatus');
    if (userStatus) {
        const roleText = userRole === 'ADMIN' ? 'Administrator' :
            userRole === 'MODERATOR' ? 'Moderator' : 'Member';
        userStatus.textContent = roleText;
    }

    // Show admin panel link for admins
    const adminNavItem = document.getElementById('adminNavItem');
    if (adminNavItem && userRole === 'ADMIN') {
        adminNavItem.style.display = 'flex';
    }
}

// ═══════════════════════════════════════════════════
// 🔌 WEBSOCKET CONNECTION
// ═══════════════════════════════════════════════════
function connectWebSocket() {
    console.log('🔗 Connecting to WebSocket...');

    const socket = new SockJS('/ws');
    stompClient = Stomp.over(socket);
    stompClient.debug = null;

    stompClient.connect({}, onConnected, onError);
}

function onConnected() {
    console.log('✅ WebSocket connected');

    stompClient.subscribe('/topic/public', onMessageReceived);

    stompClient.send('/app/chat.addUser', {}, JSON.stringify({
        sender: username,
        type: 'JOIN'
    }));

    fetchOnlineUsers();
}

function onError(error) {
    console.error('❌ WebSocket error:', error);
    showNotification('Connection lost. Reconnecting...', 'error');

    setTimeout(() => {
        connectWebSocket();
    }, 5000);
}

function onMessageReceived(payload) {
    try {
        const message = JSON.parse(payload.body);

        if (message.type === 'JOIN') {
            onlineUsers.add(message.sender);
            refreshMembersLists();
            displayEventMessage(`${message.sender} joined the chat`);
        } else if (message.type === 'LEAVE') {
            onlineUsers.delete(message.sender);
            refreshMembersLists();
            displayEventMessage(`${message.sender} left the chat`);
        } else if (message.type === 'CHAT') {
            displayChatMessage(message);
        } else if (message.type === 'USER_UPDATE') {
            console.log('🔄 User update received:', message.sender);
            loadAllUsers(); // Refresh user cache

            // If it's about me, update my UI
            if (message.sender === username) {
                // If I was banned/demoted, maybe reload? For now just refresh data.
                if (message.content.includes('banned')) {
                    window.location.reload();
                }
            }
        }
    } catch (error) {
        console.error('Error processing message:', error);
    }
}

// ═══════════════════════════════════════════════════
// 💬 MESSAGE HANDLING (UPDATED FOR NEW DESIGN)
// ═══════════════════════════════════════════════════
function sendMessage(event) {
    if (event) event.preventDefault();

    const messageContent = chatInput.value.trim();
    if (!messageContent) return;

    if (!stompClient || !stompClient.connected) {
        showNotification('Not connected to server', 'error');
        return;
    }

    const chatMessage = {
        sender: username,
        content: messageContent,
        type: 'CHAT',
        timestamp: new Date().toISOString()
    };

    try {
        stompClient.send('/app/chat.sendMessage', {}, JSON.stringify(chatMessage));
        chatInput.value = '';
        if (charCount) charCount.textContent = '0';
    } catch (error) {
        console.error('Failed to send message:', error);
        showNotification('Failed to send message', 'error');
    }
}

function displayChatMessage(message) {
    const messageDate = message.timestamp ? new Date(message.timestamp) : new Date();
    const dateKey = messageDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

    // Insert date divider if date changed
    if (lastDisplayedDate !== dateKey) {
        displayDateDivider(messageDate);
        lastDisplayedDate = dateKey;
    }

    const messageElement = document.createElement('div');
    messageElement.classList.add('message');
    messageElement.setAttribute('data-id', message.id || '');

    const isOwnMessage = message.sender === username;
    if (isOwnMessage) messageElement.classList.add('message-sent');

    // Avatar
    const avatar = document.createElement('img');
    avatar.src = getAvatarUrl(message.sender);
    avatar.classList.add('message-avatar');
    avatar.alt = message.sender;
    messageElement.appendChild(avatar);

    // Content Container
    const content = document.createElement('div');
    content.classList.add('message-content');

    // Header
    const header = document.createElement('div');
    header.classList.add('message-header');

    const author = document.createElement('span');
    author.classList.add('message-author');
    author.textContent = message.sender;
    header.appendChild(author);

    // Role Badge - Prioritize current role from cache, then historical message role
    const userInfo = allUsersCache.find(u => u.username === message.sender);
    const role = userInfo?.role || message.senderRole || 'USER';
    const badge = document.createElement('span');
    badge.classList.add('role-badge');

    if (role === 'ADMIN') {
        badge.classList.add('badge-admin');
        badge.textContent = 'ADMIN';
    } else if (role === 'MODERATOR') {
        badge.classList.add('badge-mod');
        badge.textContent = 'MOD';
    } else {
        badge.classList.add('badge-user');
        badge.textContent = 'USER';
    }
    header.appendChild(badge);

    // Timestamp
    const time = document.createElement('span');
    time.classList.add('message-time');
    time.textContent = messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    header.appendChild(time);

    content.appendChild(header);

    // Message Text
    const text = document.createElement('div');
    text.classList.add('message-text');
    text.textContent = message.content;

    // Delete button (if authorized)
    if (canDeleteMessage(message)) {
        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
        deleteBtn.style.cssText = `
            position: absolute;
            top: 8px;
            right: 8px;
            background: rgba(239, 68, 68, 0.2);
            border: none;
            color: #EF4444;
            cursor: pointer;
            padding: 6px 8px;
            border-radius: 6px;
            font-size: 12px;
            opacity: 0;
            transition: all 0.2s;
        `;
        deleteBtn.onmouseover = () => deleteBtn.style.background = 'rgba(239, 68, 68, 0.3)';
        deleteBtn.onmouseout = () => deleteBtn.style.background = 'rgba(239, 68, 68, 0.2)';
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            deleteMessage(message.id, messageElement);
        };
        text.style.position = 'relative';
        text.appendChild(deleteBtn);

        // Show delete button on hover
        text.addEventListener('mouseenter', () => deleteBtn.style.opacity = '1');
        text.addEventListener('mouseleave', () => deleteBtn.style.opacity = '0');
    }

    content.appendChild(text);
    messageElement.appendChild(content);

    chatMessages.appendChild(messageElement);
    scrollToBottom();
}

function displayDateDivider(date) {
    const divider = document.createElement('div');
    divider.classList.add('date-divider');

    const dateLabel = document.createElement('span');
    dateLabel.classList.add('date-label');
    dateLabel.textContent = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();

    divider.appendChild(dateLabel);
    chatMessages.appendChild(divider);
}

function displayEventMessage(text) {
    const eventElement = document.createElement('div');
    eventElement.classList.add('event-message');
    eventElement.textContent = text;
    chatMessages.appendChild(eventElement);
    scrollToBottom();
}

function canDeleteMessage(message) {
    if (!userRole || !message.id) return false;
    if (userRole === 'ADMIN') return true;
    if (userRole === 'MODERATOR') {
        const msgRole = message.senderRole || 'USER';
        return msgRole !== 'ADMIN';
    }
    if (userRole === 'USER') {
        return message.sender === username;
    }
    return false;
}

function deleteMessage(messageId, messageElement) {
    if (!confirm('Are you sure you want to delete this message?')) return;

    fetch(`/api/chat/${messageId}`, {
        method: 'DELETE',
        headers: {
            'Authorization': 'Bearer ' + token
        }
    })
        .then(response => {
            if (response.ok) {
                messageElement.remove();
                showNotification('Message deleted', 'success');
            } else {
                throw new Error('Failed to delete message');
            }
        })
        .catch(error => {
            console.error('Delete error:', error);
            showNotification('Failed to delete message', 'error');
        });
}

function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// ═══════════════════════════════════════════════════
// 📚 DATA LOADING
// ═══════════════════════════════════════════════════
function loadChatHistory() {
    fetch('/api/chat/history', {
        headers: {
            'Authorization': 'Bearer ' + token
        }
    })
        .then(response => {
            if (!response.ok) throw new Error('Failed to load history');
            return response.json();
        })
        .then(messages => {
            console.log(`📚 Loaded ${messages.length} messages`);
            messages.forEach(message => {
                if (message.type === 'CHAT') {
                    displayChatMessage(message);
                }
            });
        })
        .catch(error => {
            console.error('Error loading chat history:', error);
        });
}

function fetchOnlineUsers() {
    fetch('/api/chat/online', {
        headers: {
            'Authorization': 'Bearer ' + token
        }
    })
        .then(response => response.json())
        .then(users => {
            onlineUsers = new Set(users);
            refreshMembersLists();
            console.log(`👥 ${onlineUsers.size} users online`);
        })
        .catch(error => {
            console.error('Error fetching online users:', error);
        });
}

function loadAllUsers() {
    return fetch('/api/users', {
        headers: {
            'Authorization': 'Bearer ' + token
        }
    })
        .then(response => response.json())
        .then(users => {
            console.log(`📋 Total users: ${users.length}`);
            allUsersCache = users;

            // Sync my role if it changed
            if (username) {
                const me = users.find(u => u.username === username);
                if (me && me.role !== userRole) {
                    console.log(`🆙 Role updated: ${userRole} -> ${me.role}`);
                    userRole = me.role;

                    // Update local storage so it persists on reload (visuals only)
                    const userInfo = JSON.parse(localStorage.getItem('user_info') || '{}');
                    userInfo.role = userRole;
                    localStorage.setItem('user_info', JSON.stringify(userInfo));

                    showNotification(`Your role has been updated to ${userRole}!`, 'info');
                }
            }

            if (totalMembersDisplay) {
                totalMembersDisplay.textContent = users.length;
            }

            updateUserUI();
            refreshMembersLists();
            return users; // Return for chaining
        })
        .catch(error => {
            console.error('Error loading users:', error);
            return []; // Return empty array on error
        });
}

// ═══════════════════════════════════════════════════
// 👥 MEMBERS UI UPDATE
// ═══════════════════════════════════════════════════
function refreshMembersLists() {
    const onlineCount = onlineUsers.size;
    if (onlineCountDisplay) onlineCountDisplay.textContent = onlineCount;
    if (onlineCountSidebar) onlineCountSidebar.textContent = onlineCount;

    if (onlineMembersList) onlineMembersList.innerHTML = '';
    if (offlineMembersList) offlineMembersList.innerHTML = '';

    onlineUsers.forEach(user => {
        if (onlineMembersList) {
            const memberItem = createMemberItem(user, true);
            onlineMembersList.appendChild(memberItem);
        }
    });

    if (allUsersCache.length > 0) {
        const offlineUsers = allUsersCache.filter(user => !onlineUsers.has(user.username));

        if (offlineCountDisplay) {
            offlineCountDisplay.textContent = offlineUsers.length;
        }

        offlineUsers.forEach(user => {
            if (offlineMembersList) {
                const memberItem = createMemberItem(user.username, false);
                offlineMembersList.appendChild(memberItem);
            }
        });
    }
}

function createMemberItem(memberUsername, isOnline) {
    const memberItem = document.createElement('div');
    memberItem.classList.add('member-item');

    const avatarUrl = getAvatarUrl(memberUsername);

    memberItem.innerHTML = `
        <div class="member-avatar-wrapper">
            <img src="${avatarUrl}" 
                 class="member-avatar" 
                 alt="${memberUsername}">
            <div class="status-dot ${isOnline ? 'online' : 'offline'}"></div>
        </div>
        <div class="member-info">
            <span class="member-name">${memberUsername}${memberUsername === username ? ' (You)' : ''}</span>
            <span class="member-status">${isOnline ? 'Online' : 'Offline'}</span>
        </div>
    `;

    memberItem.addEventListener('click', () => showProfileModal(memberUsername, false));

    return memberItem;
}

// ═══════════════════════════════════════════════════
// 🎭 PROFILE MODAL
// ═══════════════════════════════════════════════════
function openEditProfileModal() {
    showProfileModal(username, true);
}

function showProfileModal(targetUsername, allowEdit = false) {
    const modal = document.getElementById('profileModal');
    const modalAvatar = document.getElementById('modalAvatar');
    const modalUsername = document.getElementById('modalUsername');
    const modalRole = document.getElementById('modalRole');
    const modalBody = document.querySelector('.modal-body');

    const isMe = targetUsername === username;
    const userInfo = allUsersCache.find(u => u.username === targetUsername);

    // Set avatar (custom or fallback)
    if (modalAvatar) {
        modalAvatar.src = getAvatarUrl(targetUsername);
    }

    if (modalUsername) {
        modalUsername.textContent = targetUsername;
    }

    // Fetch and display REAL stats from backend
    fetchUserStats(targetUsername);

    const actionBtn = modalBody?.querySelector('.primary-btn');

    if (actionBtn) {
        if (isMe && allowEdit) {
            actionBtn.innerHTML = '<i class="fas fa-edit"></i><span>Edit Profile</span>';
            actionBtn.onclick = () => enableEditMode(modalBody, targetUsername);
        } else if (isMe && !allowEdit) {
            actionBtn.innerHTML = '<i class="fas fa-user"></i><span>Your Profile</span>';
            actionBtn.onclick = () => closeProfileModal();
        } else {
            actionBtn.innerHTML = '<i class="fas fa-comment"></i><span>Send Message</span>';
            actionBtn.onclick = () => {
                closeProfileModal();
                showNotification('Private messaging coming soon!', 'info');
            };
        }
    }

    if (modalRole) {
        const role = userInfo?.role || 'USER';
        modalRole.textContent = role === 'ADMIN' ? 'Administrator' :
            role === 'MODERATOR' ? 'Moderator' : 'Member';
    }

    modal?.classList.add('active');
}

// Fetch real user stats and update the modal
function fetchUserStats(targetUsername) {
    fetch(`/api/users/${targetUsername}/stats`, {
        headers: { 'Authorization': 'Bearer ' + token }
    })
        .then(res => res.json())
        .then(stats => {
            // Update message count
            const msgCountEl = document.querySelector('.stat-card:first-child .stat-value');
            if (msgCountEl) msgCountEl.textContent = stats.messageCount || 0;

            // Update days active
            const daysActiveEl = document.querySelector('.stat-card:last-child .stat-value');
            if (daysActiveEl) daysActiveEl.textContent = stats.daysActive || 1;
        })
        .catch(err => console.error('Failed to fetch user stats:', err));
}

function enableEditMode(container, currentName) {
    const nameEl = document.getElementById('modalUsername');
    if (nameEl) {
        nameEl.innerHTML = `<input type="text" id="editUsernameInput" value="${currentName}" style="background: rgba(0,0,0,0.3); border: 1px solid var(--glass-border); border-radius: 8px; padding: 8px 12px; color: white; font-size: 18px; text-align: center; width: 100%;" />`;
    }

    // Add image upload section
    const modalHeader = container.closest('.modal-container')?.querySelector('.modal-header');
    if (modalHeader && !document.getElementById('imageUploadSection')) {
        const uploadHtml = `
            <div id="imageUploadSection" style="position: absolute; bottom: -30px; left: 50%; transform: translateX(-50%); text-align: center; z-index: 10;">
                <label for="avatarUploadInput" style="display: inline-flex; align-items: center; gap: 6px; background: var(--primary); color: white; padding: 8px 16px; border-radius: 20px; font-size: 12px; font-weight: 600; cursor: pointer; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);">
                    <i class="fas fa-camera"></i>
                    <span>Change Photo</span>
                </label>
                <input type="file" id="avatarUploadInput" accept="image/*" style="display: none;" />
            </div>
        `;
        modalHeader.style.position = 'relative';
        modalHeader.insertAdjacentHTML('beforeend', uploadHtml);

        document.getElementById('avatarUploadInput').addEventListener('change', handleAvatarUpload);
    }

    const actionBtn = container.querySelector('.primary-btn');
    if (actionBtn) {
        actionBtn.innerHTML = '<i class="fas fa-save"></i><span>Save Changes</span>';
        actionBtn.onclick = () => saveProfile();
    }
}

// Handle avatar image upload
function handleAvatarUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
        showNotification('Please select an image file', 'error');
        return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
        showNotification('Image must be less than 5MB', 'error');
        return;
    }

    // Show preview immediately
    const reader = new FileReader();
    reader.onload = (e) => {
        const modalAvatar = document.getElementById('modalAvatar');
        if (modalAvatar) {
            modalAvatar.src = e.target.result;
        }
    };
    reader.readAsDataURL(file);

    // Upload to server
    const formData = new FormData();
    formData.append('file', file);

    fetch('/api/users/avatar', {
        method: 'POST',
        headers: {
            'Authorization': 'Bearer ' + token
        },
        body: formData
    })
        .then(res => res.json())
        .then(data => {
            if (data.message) {
                showNotification('Profile photo updated!', 'success');
                // Refresh user cache to get hasProfileImage flag
                loadAllUsers();
            }
        })
        .catch(err => {
            console.error('Upload error:', err);
            showNotification('Failed to upload image', 'error');
        });
}

function saveProfile() {
    const newName = document.getElementById('editUsernameInput')?.value.trim();
    const avatarStyle = document.getElementById('avatarStyleSelect')?.value || 'bottts';

    if (!newName) {
        showNotification("Username cannot be empty", 'error');
        return;
    }

    fetch('/api/users/profile', {
        method: 'PUT',
        headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username: newName, avatarStyle: avatarStyle })
    })
        .then(res => res.json())
        .then(data => {
            if (data.usernameChanged) {
                showNotification('Profile updated! Please login again.', 'info');
                setTimeout(() => handleLogout(), 2000);
            } else if (data.message) {
                loadAllUsers();
                showNotification('Profile updated successfully!', 'success');
                closeProfileModal();
            }
        })
        .catch(err => {
            console.error(err);
            showNotification('Failed to update profile', 'error');
        });
}

function closeProfileModal() {
    // Clean up edit mode elements
    const uploadSection = document.getElementById('imageUploadSection');
    if (uploadSection) uploadSection.remove();

    profileModal?.classList.remove('active');
}

// ═══════════════════════════════════════════════════
// 🎯 EVENT LISTENERS
// ═══════════════════════════════════════════════════
function setupEventListeners() {
    if (sendBtn) {
        sendBtn.addEventListener('click', sendMessage);
    }

    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        chatInput.addEventListener('input', () => {
            if (charCount) {
                charCount.textContent = chatInput.value.length;
            }
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            handleLogout();
        });
    }

    if (modalClose) {
        modalClose.addEventListener('click', closeProfileModal);
    }

    if (profileModal) {
        profileModal.addEventListener('click', (e) => {
            if (e.target === profileModal) {
                closeProfileModal();
            }
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && profileModal?.classList.contains('active')) {
            closeProfileModal();
        }
    });
}

// ═══════════════════════════════════════════════════
// 🚪 LOGOUT
// ═══════════════════════════════════════════════════
function handleLogout() {
    if (stompClient && stompClient.connected) {
        stompClient.send('/app/chat.removeUser', {}, JSON.stringify({
            sender: username,
            type: 'LEAVE'
        }));
        stompClient.disconnect();
    }

    localStorage.removeItem('jwt_token');
    localStorage.removeItem('user_info');
    window.location.href = 'index.html';
}

// ═══════════════════════════════════════════════════
// 🔔 NOTIFICATIONS
// ═══════════════════════════════════════════════════
function showNotification(message, type = 'info') {
    const colors = {
        error: '#EF4444',
        success: '#10B981',
        info: '#6366F1'
    };

    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 24px;
        right: 24px;
        background: ${colors[type] || colors.info};
        color: white;
        padding: 16px 24px;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        z-index: 10000;
        font-weight: 500;
        font-size: 14px;
        animation: slideInRight 0.3s ease;
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from { transform: translateX(400px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(400px); opacity: 0; }
    }
`;
document.head.appendChild(style);

// ═══════════════════════════════════════════════════
// 🔄 PERIODIC UPDATES
// ═══════════════════════════════════════════════════
setInterval(() => {
    if (stompClient && stompClient.connected) {
        fetchOnlineUsers();
    }
}, 30000);

// ═══════════════════════════════════════════════════
// 📁 FILES SECTION
// ═══════════════════════════════════════════════════
const filesSection = document.getElementById('filesSection');
const filesList = document.getElementById('filesList');
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const uploadBtn = document.getElementById('uploadBtn');
const fileCountDisplay = document.getElementById('fileCount');
const mainContent = document.querySelector('.main-content');

let currentView = 'chat';

// Navigation switching
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
        const view = item.dataset.view;
        switchView(view);

        // Update active state
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        item.classList.add('active');
    });
});

function switchView(view) {
    currentView = view;

    if (view === 'chat') {
        mainContent.style.display = 'flex';
        filesSection.style.display = 'none';
    } else if (view === 'files') {
        mainContent.style.display = 'none';
        filesSection.style.display = 'flex';
        loadFiles();
    } else if (view === 'settings') {
        // Could add settings view later
        showNotification('Settings coming soon!');
    }
}

// File upload functionality
if (uploadBtn) {
    uploadBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        fileInput.click();
    });
}

if (uploadArea) {
    uploadArea.addEventListener('click', () => fileInput.click());

    // Drag and drop
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('drag-over');
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('drag-over');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFileUpload(files);
        }
    });
}

if (fileInput) {
    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
            handleFileUpload(fileInput.files);
        }
    });
}

async function handleFileUpload(files) {
    for (const file of files) {
        // Check file size (50MB limit)
        if (file.size > 50 * 1024 * 1024) {
            showNotification(`${file.name} is too large (max 50MB)`);
            continue;
        }

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('/api/files/upload', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + token
                },
                body: formData
            });

            if (response.ok) {
                showNotification(`${file.name} uploaded successfully!`);
                loadFiles();
            } else {
                const error = await response.json();
                showNotification(error.message || 'Upload failed');
            }
        } catch (error) {
            console.error('Upload error:', error);
            showNotification('Failed to upload file');
        }
    }

    fileInput.value = '';
}

async function loadFiles() {
    try {
        const response = await fetch('/api/files', {
            headers: {
                'Authorization': 'Bearer ' + token
            }
        });

        if (response.ok) {
            const files = await response.json();
            renderFiles(files);
            if (fileCountDisplay) {
                fileCountDisplay.textContent = files.length;
            }
        }
    } catch (error) {
        console.error('Error loading files:', error);
    }
}

function renderFiles(files) {
    if (!filesList) return;

    if (files.length === 0) {
        filesList.innerHTML = `
            <div class="files-empty">
                <i class="fas fa-folder-open"></i>
                <h4>No files yet</h4>
                <p>Upload files to share with everyone!</p>
            </div>
        `;
        return;
    }

    filesList.innerHTML = files.map(file => `
        <div class="file-card" data-id="${file.id}">
            <div class="file-icon ${getFileIconClass(file.contentType)}">
                <i class="${getFileIcon(file.contentType)}"></i>
            </div>
            <div class="file-info">
                <div class="file-name" title="${file.filename}">${file.filename}</div>
                <div class="file-meta">
                    <span>${formatFileSize(file.fileSize)}</span>
                    <span>by ${file.uploadedBy}</span>
                </div>
            </div>
            <div class="file-actions">
                <button class="file-action-btn download" onclick="downloadFile(${file.id}, '${file.filename}')" title="Download">
                    <i class="fas fa-download"></i>
                </button>
                ${file.uploadedBy === username ? `
                    <button class="file-action-btn delete" onclick="deleteFile(${file.id})" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                ` : ''}
            </div>
        </div>
    `).join('');
}

function getFileIcon(contentType) {
    if (!contentType) return 'fas fa-file';
    if (contentType.startsWith('image/')) return 'fas fa-image';
    if (contentType.startsWith('video/')) return 'fas fa-video';
    if (contentType.startsWith('audio/')) return 'fas fa-music';
    if (contentType.includes('pdf')) return 'fas fa-file-pdf';
    if (contentType.includes('word') || contentType.includes('document')) return 'fas fa-file-word';
    if (contentType.includes('zip') || contentType.includes('rar') || contentType.includes('archive')) return 'fas fa-file-archive';
    if (contentType.includes('excel') || contentType.includes('spreadsheet')) return 'fas fa-file-excel';
    return 'fas fa-file';
}

function getFileIconClass(contentType) {
    if (!contentType) return '';
    if (contentType.startsWith('image/')) return 'image';
    if (contentType.startsWith('video/')) return 'video';
    if (contentType.startsWith('audio/')) return 'audio';
    if (contentType.includes('pdf')) return 'pdf';
    if (contentType.includes('word') || contentType.includes('document')) return 'doc';
    if (contentType.includes('zip') || contentType.includes('archive')) return 'zip';
    return '';
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function downloadFile(id, filename) {
    try {
        const response = await fetch(`/api/files/${id}`, {
            headers: {
                'Authorization': 'Bearer ' + token
            }
        });

        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } else {
            showNotification('Failed to download file');
        }
    } catch (error) {
        console.error('Download error:', error);
        showNotification('Failed to download file');
    }
}

async function deleteFile(id) {
    if (!confirm('Are you sure you want to delete this file?')) return;

    try {
        const response = await fetch(`/api/files/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': 'Bearer ' + token
            }
        });

        if (response.ok) {
            showNotification('File deleted successfully');
            loadFiles();
        } else {
            const error = await response.json();
            showNotification(error.message || 'Failed to delete file');
        }
    } catch (error) {
        console.error('Delete error:', error);
        showNotification('Failed to delete file');
    }
}
