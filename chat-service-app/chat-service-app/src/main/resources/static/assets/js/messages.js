/**
 * Messages Module - Handles sending, loading, and displaying chat messages.
 */
import { escapeHtml, scrollToBottom, showToast } from './ui.js';

/**
 * Load messages for a room from the REST API.
 */
export async function loadMessages(app, roomId) {
    try {
        const response = await fetch(`/api/messages/rooms/${roomId}`, {
            headers: { 'Authorization': `Bearer ${app.token}` }
        });
        if (response.ok) {
            const data = await response.json();
            if (data.content) {
                displayMessages(app, data.content.reverse());
            } else if (Array.isArray(data)) {
                displayMessages(app, data);
            }
        } else {
            console.error('Failed to load messages:', response.status);
            showToast('Error loading messages', 'error');
        }
    } catch (error) {
        console.error('Error loading messages:', error);
        showToast('Error loading messages', 'error');
    }
}

/**
 * Display a batch of messages (used for initial load).
 */
export function displayMessages(app, messages) {
    const messageArea = document.getElementById('chat-messages');
    messageArea.innerHTML = '';

    if (!messages || !Array.isArray(messages)) {
        console.error("displayMessages received invalid data:", messages);
        return;
    }

    let lastMessageTime = null;

    messages.forEach(messageData => {
        const messageElement = document.createElement('div');
        const isOwnMessage = messageData.sender.username === app.currentUser.username;
        messageElement.className = `message ${isOwnMessage ? 'own' : ''}`;

        const date = messageData.createdAt ? new Date(messageData.createdAt) : new Date();
        const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        messageElement.dataset.timestamp = timeString;

        const showTime = timeString !== lastMessageTime;
        lastMessageTime = timeString;

        const senderDisplayName = messageData.sender ? escapeHtml(messageData.sender.displayName) : 'Unknown User';
        const messageText = messageData.text ? escapeHtml(messageData.text) : '...';

        messageElement.innerHTML = `
            <div class="message-content">
                <div class="message-header">
                    <span class="message-sender">${senderDisplayName}</span>
                    ${showTime ? `<span class="message-time">${timeString}</span>` : ''}
                </div>
                <div class="message-text">${messageText}</div>
            </div>
        `;

        messageArea.appendChild(messageElement);
    });

    scrollToBottom();
}

/**
 * Display a single incoming message (real-time via WebSocket).
 */
export function displayMessage(app, messageData, animate = true) {
    if (messageData.id && document.getElementById('msg-' + messageData.id)) {
        console.log('Duplicate message ignored:', messageData.id);
        return;
    }

    const messageArea = document.getElementById('chat-messages');
    const messageElement = document.createElement('div');
    if (messageData.id) {
        messageElement.id = 'msg-' + messageData.id;
    }

    const isOwnMessage = messageData.sender.username === app.currentUser.username;
    messageElement.className = `message ${isOwnMessage ? 'own' : ''}`;

    const date = messageData.timestamp ? new Date(messageData.timestamp) : new Date();
    const timestamp = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    messageElement.dataset.timestamp = timestamp;

    const lastMessageElement = messageArea.lastElementChild;
    const lastTime = lastMessageElement ? lastMessageElement.dataset.timestamp : null;
    const showTime = timestamp !== lastTime;

    const initials = messageData.sender.displayName.split(' ').map(n => n[0]).join('').toUpperCase();

    messageElement.innerHTML = `
        <div class="message-avatar">${initials}</div>
        <div class="message-content">
            <div class="message-header">
                <span class="message-sender">${escapeHtml(messageData.sender.displayName)}</span>
                ${showTime ? `<span class="message-time">${timestamp}</span>` : ''}
            </div>
            <div class="message-text">${escapeHtml(messageData.text)}</div>
        </div>
    `;

    if (animate) {
        messageElement.style.opacity = '0';
        messageElement.style.transform = 'translateY(20px)';
    }

    messageArea.appendChild(messageElement);

    if (animate) {
        requestAnimationFrame(() => {
            messageElement.style.transition = 'all 0.3s ease';
            messageElement.style.opacity = '1';
            messageElement.style.transform = 'translateY(0)';
        });
    }

    scrollToBottom();
}

/**
 * Display a room event (join, leave, status change, kick, mute toggle).
 */
export function displayEvent(app, event) {
    const timestamp = new Date(event.timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
    });

    if (event.type === 'STATUS_UPDATE') {
        const statusIndicator = document.getElementById('room-status-indicator');
        if (statusIndicator && event.user.username !== app.currentUser.username) {
            if (event.user.status === 'ONLINE') {
                statusIndicator.textContent = 'Online';
            } else {
                statusIndicator.textContent = 'Last seen at ' + timestamp;
            }
        }
    } else {
        if (event.adminOnly) {
            // Check if current user is admin to decide whether to show this event
            const isGroupChat = app.currentRoomType === 'GROUP_CHAT';
            let amIAdmin = false;
            if (isGroupChat && event.roomId) {
                // If we know the room and have members loaded, check role
                const membersCount = document.getElementById('room-members-count');
                if (membersCount) {
                    // Quick UI check: if we have the mute toggle, we are admin in this room
                    amIAdmin = !!document.getElementById('mute-room-toggle');
                }
            }
            if (!amIAdmin) {
                // Return early, do not display this message
                return;
            }
        }

        const messageArea = document.getElementById('chat-messages');
        const eventElement = document.createElement('div');
        eventElement.className = 'system-message';

        eventElement.innerHTML = `${escapeHtml(event.message || '')} <span style="font-size: 0.8em; opacity: 0.7;">${timestamp}</span>`;
        messageArea.appendChild(eventElement);
        scrollToBottom();
    }

    // Refresh member list if needed
    if (event.type === 'USER_JOINED' || event.type === 'USER_LEFT') {
        app.loadRoomMembers(app.currentRoom);
    }
}

/**
 * Display typing indicator.
 */
export function displayTyping(app, typing) {
    const typingIndicator = document.getElementById('typing-indicator');

    if (typing.isTyping && typing.user.username !== app.currentUser.username) {
        typingIndicator.textContent = `${typing.user.displayName} is typing...`;
        typingIndicator.style.display = 'block';

        setTimeout(() => {
            if (typingIndicator.textContent.includes(typing.user.displayName)) {
                typingIndicator.textContent = '';
                typingIndicator.style.display = 'none';
            }
        }, 3000);
    }
}

/**
 * Send a message to the current room.
 */
export function sendMessage(app) {
    const messageInput = document.getElementById('message-input');
    const text = messageInput.value.trim();

    if (!text || !app.currentRoom || !app.stompClient || !app.stompClient.connected) {
        return;
    }

    app.stompClient.send('/app/rooms/' + app.currentRoom + '/send', {},
        JSON.stringify({ text: text }));

    messageInput.value = '';
    handleTyping(app, false);
}

/**
 * Handle typing indicator logic.
 */
export function handleTyping(app, isTyping = true) {
    if (!app.currentRoom || !app.stompClient || !app.stompClient.connected) {
        return;
    }

    if (app.typingTimer) {
        clearTimeout(app.typingTimer);
    }

    if (isTyping && !app.isTyping) {
        app.isTyping = true;
        app.stompClient.send('/app/rooms/' + app.currentRoom + '/typing', {},
            JSON.stringify({ isTyping: true }));
    }

    app.typingTimer = setTimeout(() => {
        if (app.isTyping) {
            app.isTyping = false;
            app.stompClient.send('/app/rooms/' + app.currentRoom + '/typing', {},
                JSON.stringify({ isTyping: false }));
        }
    }, 1000);
}
