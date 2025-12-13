'use strict';

const chatPage = document.querySelector('#chat-page');
const usernameForm = document.querySelector('#usernameForm');
const messageForm = document.querySelector('#messageForm');
const messageInput = document.querySelector('#message');
const messageArea = document.querySelector('#chatMessages');
const connectingElement = document.querySelector('.connecting');

let stompClient = null;
let username = null;
let subscription = null;

// Load user info from Login
const userInfo = JSON.parse(localStorage.getItem('user_info'));
if (userInfo) {
    username = userInfo.username;
    // Auto-connect if on home page
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

    // Load History (Optional, enables persistence UI)
    fetch('/api/chat/history', {
        headers: {
            'Authorization': 'Bearer ' + localStorage.getItem('jwt_token')
        }
    })
        .then(response => {
            if (!response.ok) throw new Error("Failed to load history");
            return response.json();
        })
        .then(messages => {
            messages.forEach(displayMessage);
        })
        .catch(err => console.error("History load error:", err));
}

function onError(error) {
    console.error('Could not connect to WebSocket server. Please refresh this page to try again!');
}

function sendMessage(event) {
    if (event) event.preventDefault();

    // Get input from either standard input or code input (if we were supports code snippets)
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

// Bind Enter key
document.getElementById('chatInput').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

function onMessageReceived(payload) {
    const message = JSON.parse(payload.body);
    displayMessage(message);
}

function displayMessage(message) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message');

    if (message.type === 'JOIN') {
        messageElement.classList.add('event-message');
        message.content = message.sender + ' joined!';
        // Update online count if we had handle for it
    } else if (message.type === 'LEAVE') {
        messageElement.classList.add('event-message');
        message.content = message.sender + ' left!';
    } else {
        // Normal Chat Message
        if (message.sender === username) {
            messageElement.classList.add('message-sent');
        } else {
            messageElement.classList.add('message-received');
        }

        const senderElement = document.createElement('div');
        senderElement.classList.add('message-sender');
        // Add avatar icon
        senderElement.innerHTML = `<i class="fas fa-user-circle"></i> ${message.sender}`;
        messageElement.appendChild(senderElement);
    }

    const textElement = document.createElement('div');
    textElement.classList.add('message-text');
    textElement.textContent = message.content; // textContent prevents XSS
    messageElement.appendChild(textElement);

    // Add Timestamp
    const timeElement = document.createElement('span');
    timeElement.classList.add('message-timestamp');
    const date = message.timestamp ? new Date(message.timestamp) : new Date();
    timeElement.textContent = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    messageElement.appendChild(timeElement);

    messageArea.appendChild(messageElement);
    messageArea.scrollTop = messageArea.scrollHeight;
}

// Logout
document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('user_info');
    if (stompClient) stompClient.disconnect();
    window.location.href = 'index.html';
});
