'use strict';

const chatPage = document.querySelector('#chat-page');
const usernameForm = document.querySelector('#usernameForm');
const messageForm = document.querySelector('#messageForm');
const messageInput = document.querySelector('#message');
const messageArea = document.querySelector('#chatMessages');
const connectingElement = document.querySelector('.connecting');
const onlineMembersList = document.querySelector('#onlineMembersList');

let stompClient = null;
let username = null;
let userRole = null;
let subscription = null;
let onlineUsers = new Set();

// Parse JWT to get Role
function parseJwt(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function (c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        return {};
    }
}

// Load user info from Login
const userInfo = JSON.parse(localStorage.getItem('user_info'));
const token = localStorage.getItem('jwt_token');

if (userInfo && token) {
    username = userInfo.username;
    // Extract Role from Token
    const decoded = parseJwt(token);
    userRole = decoded.role || 'USER';
    console.log("MY IDENTITY:", username, "| MY ROLE:", userRole); // DEBUG LOG
    console.log("Full Token Payload:", decoded); // DEBUG LOG

    // Update Avatar on UI
    if (document.getElementById('displayUsername')) {
        document.getElementById('displayUsername').textContent = username;
    }
    const avatarImg = document.getElementById('headerAvatar');
    if (avatarImg) {
        avatarImg.src = `https://api.dicebear.com/7.x/bottts/svg?seed=${username}`;
    }

    connect();
} else {
    window.location.href = 'index.html';
}

function connect() {
    if (username) {
        const socket = new SockJS('/ws');
        stompClient = Stomp.over(socket);
        // Disable debug logging for cleaner console
        stompClient.debug = null;

        stompClient.connect({}, onConnected, onError);
    }
}

function onConnected() {
    // Subscribe to the Public Topic
    subscription = stompClient.subscribe('/topic/public', onMessageReceived);

    // Tell your username to the server
    stompClient.send("/app/chat.addUser",
        {},
        JSON.stringify({ sender: username, type: 'JOIN' })
    );

    // Load History
    fetch('/api/chat/history', {
        headers: {
            'Authorization': 'Bearer ' + token
        }
    })
        .then(response => {
            if (!response.ok) throw new Error("Failed to load history");
            return response.json();
        })
        .then(messages => {
            messages.forEach(displayMessage);
        })
        .catch(console.error);

    // Load Initial Online Users
    fetchOnlineUsers();
}

function fetchOnlineUsers() {
    fetch('/api/chat/online', {
        headers: { 'Authorization': 'Bearer ' + token }
    })
        .then(res => res.json())
        .then(users => {
            onlineUsers = new Set(users);
            updateOnlineUI();
        });
}

function onError(error) {
    console.error('WebSocket Error:', error);
}

function sendMessage(event) {
    if (event) event.preventDefault();

    const messageContent = document.querySelector('#chatInput').value.trim();

    if (messageContent && stompClient) {
        const chatMessage = {
            sender: username,
            content: messageContent,
            type: 'CHAT'
        };
        stompClient.send("/app/chat.sendMessage", {}, JSON.stringify(chatMessage));
        document.querySelector('#chatInput').value = '';
    }
}

document.getElementById('chatInput').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

function onMessageReceived(payload) {
    const message = JSON.parse(payload.body);

    // Handle Online Functionality
    if (message.type === 'JOIN') {
        onlineUsers.add(message.sender);
        updateOnlineUI();
    } else if (message.type === 'LEAVE') {
        onlineUsers.delete(message.sender);
        updateOnlineUI();
    }

    // If it's a DELETE notification, we might want to just reload or remove via ID
    // For now we just display new messages.
    displayMessage(message);
}

function updateOnlineUI() {
    if (!onlineMembersList) return;
    onlineMembersList.innerHTML = '';

    onlineUsers.forEach(user => {
        const item = document.createElement('div');
        item.classList.add('online-member-item');
        item.innerHTML = `
            <div class="member-avatar">${user.charAt(0).toUpperCase()}</div>
            <div class="member-info">
                <span class="member-name">${user}</span>
            </div>
            <div class="status-dot"></div>
        `;
        onlineMembersList.appendChild(item);
    });
}


function displayMessage(message) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message');
    // If message has ID, set it for DOM manip (deletion)
    if (message.id) messageElement.setAttribute('data-id', message.id);

    if (message.type === 'JOIN') {
        messageElement.classList.add('event-message');
        message.content = message.sender + ' joined!';
        const textElement = document.createElement('div');
        textElement.classList.add('message-text');
        textElement.textContent = message.content;
        messageElement.appendChild(textElement);

    } else if (message.type === 'LEAVE') {
        messageElement.classList.add('event-message');
        message.content = message.sender + ' left!';
        const textElement = document.createElement('div');
        textElement.classList.add('message-text');
        textElement.textContent = message.content;
        messageElement.appendChild(textElement);

    } else {
        // Chat Message
        if (message.sender === username) {
            messageElement.classList.add('message-sent');
        } else {
            messageElement.classList.add('message-received');
        }

        // Message DOM Construction
        // New Structure: 
        // .message
        //    .message-meta (Sender Name + Badge) -> Left aligned
        //    .message-content (Bubble)
        //    .timestamp

        // Sender Meta
        if (message.sender !== username) {
            const meta = document.createElement('div');
            meta.classList.add('message-meta');

            let senderHtml = `<span class="sender-name">${message.sender}</span>`;
            const role = message.senderRole || 'USER';
            if (role === 'ADMIN') senderHtml += ` <span class="role-badge badge-admin">ADMIN</span>`;
            else if (role === 'MODERATOR') senderHtml += ` <span class="role-badge badge-mod">MOD</span>`;

            meta.innerHTML = senderHtml;
            messageElement.appendChild(meta);
        }

        // Content Bubble
        const contentDiv = document.createElement('div');
        contentDiv.classList.add('message-content');
        contentDiv.textContent = message.content;

        // Delete Button (Inside bubble or next to it? Let's put inside for clean look or use old logic)
        // Design calls for premium look. Let's append delete button to contentDiv if allowed
        if (canDelete(message)) {
            const delBtn = document.createElement('button');
            delBtn.innerHTML = '<i class="fas fa-trash"></i>';
            delBtn.style.cssText = "background:none; border:none; color:rgba(255,255,255,0.5); cursor:pointer; margin-left:10px;";
            delBtn.onclick = (e) => { e.stopPropagation(); deleteMessage(message.id, messageElement); };
            contentDiv.appendChild(delBtn);
        }

        messageElement.appendChild(contentDiv);

        // Timestamp
        const timeDiv = document.createElement('div');
        timeDiv.classList.add('timestamp');
        const date = message.timestamp ? new Date(message.timestamp) : new Date();
        timeDiv.textContent = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        messageElement.appendChild(timeDiv);
    }

    messageArea.appendChild(messageElement);
    messageArea.scrollTop = messageArea.scrollHeight;
}

function canDelete(message) {
    if (!userRole) return false;
    if (!message.id) return false; // Needs ID to delete

    if (userRole === 'ADMIN') return true; // Admin deletes all

    if (userRole === 'MODERATOR') {
        // Mod can delete anyone EXCEPT Admin
        const msgRole = message.senderRole || 'USER';
        return msgRole !== 'ADMIN';
    }

    if (userRole === 'USER') {
        // User deletes only own
        return message.sender === username;
    }

    return false;
}

function deleteMessage(id, element) {
    if (!confirm("Are you sure you want to delete this message?")) return;

    fetch(`/api/chat/${id}`, {
        method: 'DELETE',
        headers: {
            'Authorization': 'Bearer ' + token
        }
    })
        .then(res => {
            if (res.ok) {
                element.remove(); // Remove from UI immediately
            } else {
                alert('Failed to delete message');
            }
        });
}

// Logout
document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('user_info');
    if (stompClient) stompClient.disconnect();
    window.location.href = 'index.html';
});

// Character counter
const chatInput = document.getElementById('chatInput');
const charCount = document.getElementById('charCount');

chatInput.addEventListener('input', () => {
    charCount.textContent = chatInput.value.length;
});

// User dropdown toggle
const userAvatarBtn = document.getElementById('userAvatarBtn');
const userDropdown = document.getElementById('userDropdown');

// Profile modal
function showProfileModal(username) {
    const modal = document.getElementById('profileModal');
    const modalAvatar = document.getElementById('modalAvatar');
    const modalUsername = document.getElementById('modalUsername');
    
    modalAvatar.src = `https://api.dicebear.com/7.x/bottts/svg?seed=${username}`;
    modalUsername.textContent = username;
    
    modal.classList.add('active');
}

document.querySelector('.modal-close').addEventListener('click', () => {
    document.getElementById('profileModal').classList.remove('active');
});

// Enhanced message rendering
function displayMessage(message) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message');
    
    if (message.type === 'CHAT') {
        const isOwn = message.sender === username;
        messageElement.classList.add(isOwn ? 'message-sent' : 'message-received');
        
        if (!isOwn) {
            const header = document.createElement('div');
            header.classList.add('message-header');
            header.innerHTML = `
                <img src="https://api.dicebear.com/7.x/bottts/svg?seed=${message.sender}" 
                     class="message-avatar" alt="${message.sender}">
                <span class="message-sender">${message.sender}</span>
                ${message.senderRole === 'ADMIN' ? '<span class="role-badge badge-admin">Admin</span>' : ''}
                ${message.senderRole === 'MODERATOR' ? '<span class="role-badge badge-mod">Mod</span>' : ''}
            `;
            messageElement.appendChild(header);
        }
        
        const bubble = document.createElement('div');
        bubble.classList.add('message-bubble');
        bubble.textContent = message.content;
        messageElement.appendChild(bubble);
        
        const timestamp = document.createElement('div');
        timestamp.classList.add('message-timestamp');
        const date = message.timestamp ? new Date(message.timestamp) : new Date();
        timestamp.textContent = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        messageElement.appendChild(timestamp);
        
    } else {
        // Event message (JOIN/LEAVE)
        messageElement.classList.add('event-message');
        messageElement.textContent = `${message.sender} ${message.type === 'JOIN' ? 'joined' : 'left'} the chat`;
    }
    
    messageArea.appendChild(messageElement);
    messageArea.scrollTop = messageArea.scrollHeight;
}

// Update online members UI
function updateOnlineUI() {
    const onlineMembersList = document.getElementById('onlineMembersList');
    const onlineCountSidebar = document.getElementById('onlineCountSidebar');
    const onlineCount = document.getElementById('onlineCount');
    
    onlineMembersList.innerHTML = '';
    onlineCountSidebar.textContent = onlineUsers.size;
    onlineCount.textContent = onlineUsers.size;
    
    onlineUsers.forEach(user => {
        const memberItem = document.createElement('div');
        memberItem.classList.add('member-item');
        memberItem.innerHTML = `
            <div class="member-avatar-wrapper">
                <img src="https://api.dicebear.com/7.x/bottts/svg?seed=${user}" 
                     class="member-avatar" alt="${user}">
                <div class="status-dot online"></div>
            </div>
            <div class="member-info">
                <span class="member-name">${user}</span>
                <span class="member-status">Online</span>
            </div>
        `;
        
        memberItem.addEventListener('click', () => showProfileModal(user));
        onlineMembersList.appendChild(memberItem);
    });
}
