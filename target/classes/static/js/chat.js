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
let allUsersCache = []; // Cache all users

// DOM Elements
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
const modalClose = document.querySelector('.modal-close');
const dropdownUsername = document.getElementById('dropdownUsername');
const dropdownRole = document.getElementById('dropdownRole');
const headerAvatar = document.getElementById('headerAvatar');

// ═══════════════════════════════════════════════════
// 🚀 INITIALIZATION
// ═══════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    // Load user info from localStorage
    const userInfo = JSON.parse(localStorage.getItem('user_info'));
    token = localStorage.getItem('jwt_token');

    if (!userInfo || !token) {
        console.error('❌ No user info or token found');
        window.location.href = 'index.html';
        return;
    }

    // Set user data
    username = userInfo.username;
    userId = userInfo.id;

    // Parse JWT to get role
    const decoded = parseJwt(token);
    userRole = decoded.role || 'USER';

    console.log('✅ User authenticated:', username, '| Role:', userRole);

    // Update UI with user info
    updateUserUI();

    // Setup event listeners
    setupEventListeners();

    // Connect to WebSocket
    connectWebSocket();

    // Load initial data
    loadChatHistory();
    loadAllUsers();
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

function updateUserUI() {
    // Get avatar style from server cache for current user
    const myInfo = allUsersCache.find(u => u.username === username);
    const avatarStyle = myInfo?.avatarStyle || 'initials';

    // Update header avatar
    if (headerAvatar) {
        headerAvatar.src = `https://api.dicebear.com/7.x/${avatarStyle}/svg?seed=${username}`;
    }

    // Update dropdown
    if (dropdownUsername) dropdownUsername.textContent = username;
    if (dropdownRole) {
        const roleText = userRole === 'ADMIN' ? 'Administrator' :
            userRole === 'MODERATOR' ? 'Moderator' : 'User';
        dropdownRole.textContent = roleText;
    }

    // Update dropdown avatar
    const dropdownAvatar = document.querySelector('.dropdown-header img');
    if (dropdownAvatar) {
        dropdownAvatar.src = `https://api.dicebear.com/7.x/${avatarStyle}/svg?seed=${username}`;
    }
}

// ═══════════════════════════════════════════════════
// 🔌 WEBSOCKET CONNECTION
// ═══════════════════════════════════════════════════
function connectWebSocket() {
    console.log('🔗 Connecting to WebSocket...');

    const socket = new SockJS('/ws');
    stompClient = Stomp.over(socket);

    // Disable debug logs for cleaner console
    stompClient.debug = null;

    stompClient.connect({}, onConnected, onError);
}

function onConnected() {
    console.log('✅ WebSocket connected');

    // Subscribe to public chat topic
    stompClient.subscribe('/topic/public', onMessageReceived);

    // Announce user joined
    stompClient.send('/app/chat.addUser', {}, JSON.stringify({
        sender: username,
        type: 'JOIN'
    }));

    // Fetch initial online users
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
        }
    } catch (error) {
        console.error('Error processing message:', error);
    }
}

// ═══════════════════════════════════════════════════
// 💬 MESSAGE HANDLING
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
        charCount.textContent = '0';
    } catch (error) {
        console.error('Failed to send message:', error);
        showNotification('Failed to send message', 'error');
    }
}

function displayChatMessage(message) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message');
    messageElement.setAttribute('data-id', message.id || '');

    // Debug: Log comparison
    console.log(`Comparing sender: "${message.sender}" vs username: "${username}" => ${message.sender === username}`);

    const isOwnMessage = message.sender === username;
    messageElement.classList.add(isOwnMessage ? 'message-sent' : 'message-received');

    // Message header
    const header = document.createElement('div');
    header.classList.add('message-header');

    if (isOwnMessage) {
        header.style.flexDirection = 'row-reverse';
        header.style.justifyContent = 'flex-start';
    }

    const avatar = document.createElement('img');
    // Look up avatar style from server cache
    const senderInfo = allUsersCache.find(u => u.username === message.sender);
    const avatarStyle = senderInfo?.avatarStyle || 'initials';
    avatar.src = `https://api.dicebear.com/7.x/${avatarStyle}/svg?seed=${message.sender}`;
    avatar.alt = message.sender;
    avatar.classList.add('message-avatar');
    header.appendChild(avatar);

    const senderName = document.createElement('span');
    senderName.classList.add('message-sender');
    senderName.textContent = message.sender;
    header.appendChild(senderName);

    // Role badge
    const role = message.senderRole || 'USER';
    if (role === 'ADMIN') {
        const badge = document.createElement('span');
        badge.classList.add('role-badge', 'badge-admin');
        badge.textContent = 'ADMIN';
        header.appendChild(badge);
    } else if (role === 'MODERATOR') {
        const badge = document.createElement('span');
        badge.classList.add('role-badge', 'badge-mod');
        badge.textContent = 'MOD';
        header.appendChild(badge);
    }

    messageElement.appendChild(header);

    // Message bubble
    const bubble = document.createElement('div');
    bubble.classList.add('message-bubble');
    bubble.textContent = message.content;

    // Delete button (if user can delete)
    if (canDeleteMessage(message)) {
        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
        deleteBtn.classList.add('delete-message-btn');
        deleteBtn.style.cssText = `
            background: none;
            border: none;
            color: rgba(255, 255, 255, 0.5);
            cursor: pointer;
            margin-left: 10px;
            padding: 4px 8px;
            border-radius: 6px;
            transition: all 0.2s;
        `;
        deleteBtn.onmouseover = () => deleteBtn.style.background = 'rgba(255, 82, 82, 0.2)';
        deleteBtn.onmouseout = () => deleteBtn.style.background = 'none';
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            deleteMessage(message.id, messageElement);
        };
        bubble.appendChild(deleteBtn);
    }

    messageElement.appendChild(bubble);

    // Timestamp
    const timestamp = document.createElement('div');
    timestamp.classList.add('message-timestamp');
    const date = message.timestamp ? new Date(message.timestamp) : new Date();
    timestamp.textContent = date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
    });
    messageElement.appendChild(timestamp);

    // Append to chat
    chatMessages.appendChild(messageElement);
    scrollToBottom();
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
    fetch('/api/users', {
        headers: {
            'Authorization': 'Bearer ' + token
        }
    })
        .then(response => response.json())
        .then(users => {
            console.log(`📋 Total users: ${users.length}`);
            allUsersCache = users;

            if (totalMembersDisplay) {
                totalMembersDisplay.textContent = users.length;
            }

            // Update UI with server avatar styles
            updateUserUI();
            refreshMembersLists();
        })
        .catch(error => {
            console.error('Error loading users:', error);
        });
}

// ═══════════════════════════════════════════════════
// 👥 MEMBERS UI UPDATE - FIXED
// ═══════════════════════════════════════════════════
function refreshMembersLists() {
    // Update online count
    const onlineCount = onlineUsers.size;
    if (onlineCountDisplay) onlineCountDisplay.textContent = onlineCount;
    if (onlineCountSidebar) onlineCountSidebar.textContent = onlineCount;

    // Clear both lists
    if (onlineMembersList) onlineMembersList.innerHTML = '';
    if (offlineMembersList) offlineMembersList.innerHTML = '';

    // Populate online members
    onlineUsers.forEach(user => {
        if (onlineMembersList) {
            const memberItem = createMemberItem(user, true);
            onlineMembersList.appendChild(memberItem);
        }
    });

    // Populate offline members
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

    // Look up avatar style from server cache
    const userInfo = allUsersCache.find(u => u.username === memberUsername);
    const avatarStyle = userInfo?.avatarStyle || 'initials';

    memberItem.innerHTML = `
        <div class="member-avatar-wrapper">
            <img src="https://api.dicebear.com/7.x/${avatarStyle}/svg?seed=${memberUsername}" 
                 class="member-avatar" 
                 alt="${memberUsername}">
            <div class="status-dot ${isOnline ? 'online' : 'offline'}"></div>
        </div>
        <div class="member-info">
            <span class="member-name">${memberUsername}${memberUsername === username ? ' (You)' : ''}</span>
            <span class="member-status">${isOnline ? 'Online' : 'Offline'}</span>
        </div>
    `;

    // Click to show profile (view-only for members list)
    memberItem.addEventListener('click', () => showProfileModal(memberUsername, false));

    return memberItem;
}

// ═══════════════════════════════════════════════════
// 🎭 PROFILE MODAL - FIXED
// ═══════════════════════════════════════════════════
function openEditProfileModal() {
    // Open profile modal in edit mode for current user
    showProfileModal(username, true);
}

function showProfileModal(targetUsername, allowEdit = false) {
    const modal = document.getElementById('profileModal');
    const modalAvatar = document.getElementById('modalAvatar');
    const modalUsername = document.getElementById('modalUsername');
    const modalRole = document.getElementById('modalRole');
    const profileBody = document.querySelector('.profile-body');

    // Use saved avatar style for current user
    const isMe = targetUsername === username;
    const avatarStyle = isMe ? (localStorage.getItem('avatar_style') || 'initials') : 'initials';

    if (modalAvatar) {
        modalAvatar.src = `https://api.dicebear.com/7.x/${avatarStyle}/svg?seed=${targetUsername}`;
    }

    // Reset username display to text (not input)
    if (modalUsername) {
        modalUsername.textContent = targetUsername;
    }

    const actionBtn = profileBody.querySelector('.btn-primary');

    // Only show edit option if:
    // 1. It's me AND
    // 2. allowEdit is true (clicked from header dropdown)
    if (isMe && allowEdit) {
        actionBtn.innerHTML = '<i class="fas fa-edit"></i> Edit Profile';
        actionBtn.onclick = () => enableEditMode(profileBody, targetUsername);
    } else if (isMe && !allowEdit) {
        // It's me but clicked from members list - show view only
        actionBtn.innerHTML = '<i class="fas fa-user"></i> Your Profile';
        actionBtn.onclick = () => closeProfileModal();
    } else {
        // It's someone else - show send message button
        actionBtn.innerHTML = '<i class="fas fa-comment"></i> Send Message';
        actionBtn.onclick = () => {
            closeProfileModal();
            alert('Private messaging coming soon!');
        };
    }

    if (modalRole) {
        modalRole.textContent = 'Member';
    }

    modal.classList.add('active');
}

function enableEditMode(container, currentName) {
    const nameEl = document.getElementById('modalUsername');
    nameEl.innerHTML = `<input type="text" id="editUsernameInput" value="${currentName}" class="edit-input" />`;

    // Add image selector below avatar
    const avatarContainer = container.querySelector('.profile-avatar');
    if (avatarContainer && !document.getElementById('avatarSelector')) {
        const selectorHtml = `
            <div id="avatarSelector" style="margin-top: 10px; text-align: center;">
                <label style="display: block; margin-bottom: 8px; color: var(--text-secondary); font-size: 0.85rem;">Choose Avatar Style:</label>
                <select id="avatarStyleSelect" class="edit-input" style="font-size: 1rem; padding: 10px;">
                    <option value="initials">Initials</option>
                    <option value="bottts">Robots</option>
                    <option value="avataaars">Avatars</option>
                    <option value="fun-emoji">Emoji</option>
                    <option value="pixel-art">Pixel Art</option>
                    <option value="lorelei">Lorelei</option>
                </select>
            </div>
        `;
        avatarContainer.insertAdjacentHTML('afterend', selectorHtml);

        // Preview avatar on change
        document.getElementById('avatarStyleSelect').addEventListener('change', (e) => {
            const style = e.target.value;
            const previewName = document.getElementById('editUsernameInput')?.value || currentName;
            document.getElementById('modalAvatar').src = `https://api.dicebear.com/7.x/${style}/svg?seed=${previewName}`;
        });
    }

    const actionBtn = container.querySelector('.btn-primary');
    actionBtn.innerHTML = '<i class="fas fa-save"></i> Save Changes';
    actionBtn.onclick = () => saveProfile();
}

function saveProfile() {
    const newName = document.getElementById('editUsernameInput').value.trim();
    const avatarStyle = document.getElementById('avatarStyleSelect')?.value || 'initials';

    if (!newName) return alert("Username cannot be empty");

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
                alert('Profile updated! Please login again.');
                handleLogout();
            } else if (data.message) {
                // Reload users to get updated avatarStyle from server
                loadAllUsers();

                // Update header avatars in UI
                const style = data.avatarStyle || avatarStyle;
                if (headerAvatar) {
                    headerAvatar.src = `https://api.dicebear.com/7.x/${style}/svg?seed=${username}`;
                }
                const dropdownAvatar = document.querySelector('.dropdown-header img');
                if (dropdownAvatar) {
                    dropdownAvatar.src = `https://api.dicebear.com/7.x/${style}/svg?seed=${username}`;
                }
                showNotification('Avatar style updated!', 'success');
                closeProfileModal();
            }
        })
        .catch(err => {
            console.error(err);
            alert('Failed to update profile');
        });
}

function closeProfileModal() {
    // Remove avatar selector on close
    const selector = document.getElementById('avatarSelector');
    if (selector) selector.remove();

    profileModal.classList.remove('active');
}

// ═══════════════════════════════════════════════════
// 🎯 EVENT LISTENERS
// ═══════════════════════════════════════════════════
function setupEventListeners() {
    // Send message on button click
    if (sendBtn) {
        sendBtn.addEventListener('click', sendMessage);
    }

    // Send message on Enter key
    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        // Character counter
        chatInput.addEventListener('input', () => {
            if (charCount) {
                charCount.textContent = chatInput.value.length;
            }
        });
    }

    // Logout
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    // Profile Dropdown Item - Opens edit mode
    const profileMenuItem = document.getElementById('profileMenuItem');
    if (profileMenuItem) {
        profileMenuItem.addEventListener('click', (e) => {
            e.preventDefault();
            openEditProfileModal(); // Opens with edit capability
        });
    }

    // Close modal
    if (modalClose) {
        modalClose.addEventListener('click', closeProfileModal);
    }

    // Close modal on backdrop click
    if (profileModal) {
        profileModal.addEventListener('click', (e) => {
            if (e.target === profileModal) {
                closeProfileModal();
            }
        });
    }

    // Close modal on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && profileModal.classList.contains('active')) {
            closeProfileModal();
        }
    });

    // Tab switching
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            tabButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const tab = btn.getAttribute('data-tab');
            console.log('Switched to tab:', tab);
        });
    });
}

// ═══════════════════════════════════════════════════
// 🚪 LOGOUT
// ═══════════════════════════════════════════════════
function handleLogout() {
    // Disconnect WebSocket
    if (stompClient && stompClient.connected) {
        stompClient.send('/app/chat.removeUser', {}, JSON.stringify({
            sender: username,
            type: 'LEAVE'
        }));
        stompClient.disconnect();
    }

    // Clear localStorage
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('user_info');

    // Redirect to login
    window.location.href = 'index.html';
}

// ═══════════════════════════════════════════════════
// 🔔 NOTIFICATIONS
// ═══════════════════════════════════════════════════
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 90px;
        right: 20px;
        background: ${type === 'error' ? '#FF5252' : type === 'success' ? '#00E676' : '#5B7FFF'};
        color: white;
        padding: 16px 24px;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        z-index: 9999;
        animation: slideInRight 0.3s ease;
        font-weight: 500;
        font-size: 0.9rem;
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

// ═══════════════════════════════════════════════════
// 🎨 UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════
function formatTimestamp(date) {
    return new Date(date).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
    });
}

function smoothScrollToBottom() {
    chatMessages.scrollTo({
        top: chatMessages.scrollHeight,
        behavior: 'smooth'
    });
}

function isAtBottom() {
    const threshold = 100;
    return chatMessages.scrollHeight - chatMessages.scrollTop - chatMessages.clientHeight < threshold;
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }

    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }

    .delete-message-btn:hover {
        background: rgba(255, 82, 82, 0.2) !important;
        color: #FF5252 !important;
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
