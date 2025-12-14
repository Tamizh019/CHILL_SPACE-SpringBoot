document.addEventListener('DOMContentLoaded', () => {
    const aiInput = document.getElementById('aiInput');
    const aiSendBtn = document.getElementById('aiSendBtn');
    const aiMessages = document.getElementById('aiMessages');
    const aiCharCount = document.getElementById('aiCharCount');
    const welcomeTime = document.getElementById('welcomeTime');

    // CONVERSATION HISTORY - Key difference from before!
    let conversationHistory = [];

    // Set welcome message time
    if (welcomeTime) {
        welcomeTime.textContent = formatTime(new Date());
    }

    // Character counter
    if (aiInput && aiCharCount) {
        aiInput.addEventListener('input', () => {
            aiCharCount.textContent = aiInput.value.length;
        });
    }

    // Get current username
    function getUsername() {
        const el = document.getElementById('sidebarUsername');
        return el ? el.textContent : 'You';
    }

    // Format time
    function formatTime(date) {
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    }

    let isWaitingForResponse = false;

    function sendAiMessage() {
        const text = aiInput.value.trim();
        if (!text || isWaitingForResponse) return;

        isWaitingForResponse = true;

        // Add to conversation history
        conversationHistory.push({
            role: 'user',
            text: text
        });

        // User Message UI
        appendMessage('user', text, getUsername());
        aiInput.value = '';
        if (aiCharCount) aiCharCount.textContent = '0';

        // Bot Loading UI
        const loadingEl = appendMessage('bot', '<div class="typing-dots"><span>.</span><span>.</span><span>.</span></div>', 'Sparky');

        // Call Backend WITH conversation history
        fetch('/api/ai/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + localStorage.getItem('jwt_token')
            },
            body: JSON.stringify({
                query: text,
                history: conversationHistory.slice(-20) // Send last 20 messages for context
            })
        })
            .then(res => {
                if (!res.ok) throw new Error(`Server returned ${res.status}`);
                return res.json();
            })
            .then(data => {
                const bubble = loadingEl.querySelector('.ai-bubble');
                if (!bubble) return;

                const responseText = data.response || data.error || "Hmm, something went wrong 😅";

                // Add bot response to history
                conversationHistory.push({
                    role: 'model',
                    text: responseText
                });

                // Format and display
                let formatted = responseText
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
                    .replace(/`([^`]+)`/g, '<code>$1</code>')
                    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
                    .replace(/\n/g, '<br>');

                bubble.innerHTML = formatted;
            })
            .catch(err => {
                console.error('AI Error:', err);
                const bubble = loadingEl.querySelector('.ai-bubble');
                if (bubble) {
                    bubble.textContent = "Oops! I'm having trouble connecting right now 😔";
                }
            })
            .finally(() => {
                isWaitingForResponse = false;
                aiMessages.scrollTop = aiMessages.scrollHeight;
            });
    }

    if (aiSendBtn) {
        aiSendBtn.addEventListener('click', sendAiMessage);
    }

    if (aiInput) {
        aiInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendAiMessage();
        });
    }

    function appendMessage(sender, htmlContent, name) {
        const div = document.createElement('div');
        div.className = `ai-message ${sender}`;

        const isBot = sender === 'bot';
        const avatar = isBot
            ? '<i class="fas fa-robot"></i>'
            : '<i class="fas fa-user"></i>';
        const boltIcon = isBot ? '<i class="fas fa-bolt"></i>' : '';
        const time = formatTime(new Date());

        div.innerHTML = `
            <div class="ai-avatar">${avatar}</div>
            <div class="ai-msg-content">
                <div class="ai-msg-header">
                    <span class="ai-sender">${name} ${boltIcon}</span>
                    <span class="ai-time">${time}</span>
                </div>
                <div class="ai-bubble">${htmlContent}</div>
            </div>
        `;

        aiMessages.appendChild(div);
        aiMessages.scrollTop = aiMessages.scrollHeight;

        return div;
    }
});
