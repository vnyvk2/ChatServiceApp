/**
 * Messages Module - Handles sending, loading, and displaying chat messages.
 * Includes WhatsApp-style tick marks and per-member receipt tracking.
 */
import { escapeHtml, scrollToBottom, showToast } from './ui.js';

/**
 * Returns tick mark HTML based on message status.
 * Only shown on own messages.
 */
function getStatusTicks(status, isOwnMessage) {
    if (!isOwnMessage) return '';

    switch (status) {
        case 'SEEN':
            return '<span class="message-status seen" title="Seen by all">✓✓</span>';
        case 'DELIVERED':
            return '<span class="message-status delivered" title="Delivered to all">✓✓</span>';
        case 'SENT':
        default:
            return '<span class="message-status sent" title="Sent">✓</span>';
    }
}

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

            // Send delivery acknowledgement when loading messages
            sendDeliveryAck(app, roomId);
            // Send seen acknowledgement since user is viewing the room
            sendSeenAck(app, roomId);
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

        if (messageData.id) {
            messageElement.id = 'msg-' + messageData.id;
            messageElement.dataset.messageId = messageData.id;
        }

        const date = messageData.createdAt ? new Date(messageData.createdAt) : new Date();
        const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        messageElement.dataset.timestamp = timeString;

        const showTime = timeString !== lastMessageTime;
        lastMessageTime = timeString;

        const senderDisplayName = messageData.sender ? escapeHtml(messageData.sender.displayName) : 'Unknown User';
        const messageText = messageData.text ? escapeHtml(messageData.text) : '...';
        const messageStatus = messageData.status || messageData.messageStatus || 'SENT';
        const ticks = getStatusTicks(messageStatus, isOwnMessage);

        messageElement.innerHTML = `
            <div class="message-content">
                <div class="message-header">
                    <span class="message-sender">${senderDisplayName}</span>
                    ${showTime ? `<span class="message-time">${timeString}</span>` : ''}
                </div>
                <div class="message-text">${messageText}</div>
                ${ticks ? `<div class="message-meta">${ticks}</div>` : ''}
            </div>
        `;

        // Add long-press handler for own messages to show receipt details
        if (isOwnMessage && messageData.id) {
            addLongPressHandler(messageElement, app, messageData.id);
        }

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
        messageElement.dataset.messageId = messageData.id;
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
    const messageStatus = messageData.messageStatus || messageData.status || 'SENT';
    const ticks = getStatusTicks(messageStatus, isOwnMessage);

    messageElement.innerHTML = `
        <div class="message-avatar">${initials}</div>
        <div class="message-content">
            <div class="message-header">
                <span class="message-sender">${escapeHtml(messageData.sender.displayName)}</span>
                ${showTime ? `<span class="message-time">${timestamp}</span>` : ''}
            </div>
            <div class="message-text">${escapeHtml(messageData.text)}</div>
            ${ticks ? `<div class="message-meta">${ticks}</div>` : ''}
        </div>
    `;

    // Add long-press handler for own messages
    if (isOwnMessage && messageData.id) {
        addLongPressHandler(messageElement, app, messageData.id);
    }

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

    // If we received someone else's message while viewing, send seen ack
    if (!isOwnMessage && app.currentRoom) {
        sendDeliveryAck(app, app.currentRoom);
        sendSeenAck(app, app.currentRoom);
    }

    // Bubble the room to top of sidebar
    if (messageData.roomId) {
        bubbleRoomToTop(messageData.roomId);
    }
}

/**
 * Move a room item to the top of the sidebar room list.
 */
function bubbleRoomToTop(roomId) {
    const roomList = document.getElementById('room-list');
    if (!roomList) return;

    const roomItems = roomList.querySelectorAll('.room-item');
    for (const item of roomItems) {
        // Match by the onclick handler or data attribute
        const onclickAttr = item.getAttribute('onclick') || '';
        if (item.dataset.roomId === roomId || onclickAttr.includes(roomId)) {
            roomList.prepend(item);
            // Brief highlight animation
            item.style.transition = 'background 0.3s ease';
            item.style.background = 'rgba(59, 130, 246, 0.08)';
            setTimeout(() => {
                item.style.background = '';
            }, 1500);
            break;
        }
    }
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
            const isGroupChat = app.currentRoomType === 'GROUP_CHAT';
            let amIAdmin = false;
            if (isGroupChat && event.roomId) {
                const membersCount = document.getElementById('room-members-count');
                if (membersCount) {
                    amIAdmin = !!document.getElementById('mute-room-toggle');
                }
            }
            if (!amIAdmin) {
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

/**
 * Send delivery acknowledgement for a room.
 */
export function sendDeliveryAck(app, roomId) {
    if (app.stompClient && app.stompClient.connected) {
        app.stompClient.send('/app/rooms/' + roomId + '/delivered', {}, '{}');
    }
}

/**
 * Send seen acknowledgement for a room.
 */
export function sendSeenAck(app, roomId) {
    if (app.stompClient && app.stompClient.connected && app.readReceiptsEnabled !== false) {
        app.stompClient.send('/app/rooms/' + roomId + '/seen', {}, '{}');
    }
}

/**
 * Update message status ticks on existing DOM elements.
 * Called when a MESSAGE_STATUS_UPDATE event is received.
 */
export function updateMessageStatuses(messageIds, newStatus) {
    if (!messageIds || !Array.isArray(messageIds)) return;

    messageIds.forEach(msgId => {
        const msgElement = document.getElementById('msg-' + msgId);
        if (msgElement) {
            const metaDiv = msgElement.querySelector('.message-meta');
            if (metaDiv) {
                // Update existing ticks
                const tickSpan = metaDiv.querySelector('.message-status');
                if (tickSpan) {
                    tickSpan.classList.remove('sent', 'delivered', 'seen');
                    switch (newStatus) {
                        case 'SEEN':
                            tickSpan.classList.add('seen');
                            tickSpan.textContent = '✓✓';
                            tickSpan.title = 'Seen by all';
                            break;
                        case 'DELIVERED':
                            tickSpan.classList.add('delivered');
                            tickSpan.textContent = '✓✓';
                            tickSpan.title = 'Delivered to all';
                            break;
                        default:
                            tickSpan.classList.add('sent');
                            tickSpan.textContent = '✓';
                            tickSpan.title = 'Sent';
                    }
                    // Add a brief animation
                    tickSpan.classList.add('tick-updated');
                    setTimeout(() => tickSpan.classList.remove('tick-updated'), 600);
                }
            }
        }
    });
}

/**
 * Add long-press (contextmenu) handler to show receipt details.
 */
function addLongPressHandler(element, app, messageId) {
    let pressTimer = null;

    // Long press for mobile
    element.addEventListener('touchstart', (e) => {
        pressTimer = setTimeout(() => {
            e.preventDefault();
            showReceiptModal(app, messageId);
        }, 600);
    });

    element.addEventListener('touchend', () => {
        clearTimeout(pressTimer);
    });

    element.addEventListener('touchmove', () => {
        clearTimeout(pressTimer);
    });

    // Right-click for desktop
    element.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showReceiptModal(app, messageId);
    });
}

/**
 * Show receipt details modal for a message.
 */
async function showReceiptModal(app, messageId) {
    try {
        const response = await fetch(`/api/messages/${messageId}/receipts`, {
            headers: { 'Authorization': `Bearer ${app.token}` }
        });

        if (!response.ok) {
            showToast('Could not load receipt info', 'error');
            return;
        }

        const receipts = await response.json();

        // Create or update the modal
        let overlay = document.getElementById('receipt-modal-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'receipt-modal-overlay';
            overlay.className = 'receipt-overlay';
            overlay.addEventListener('click', (e) => {
                if (e.target === e.currentTarget) {
                    overlay.classList.add('hidden');
                }
            });
            document.body.appendChild(overlay);
        }

        let modal = document.getElementById('receipt-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'receipt-modal';
            modal.className = 'receipt-modal';
            overlay.appendChild(modal);
        }

        // Build receipt list HTML
        const seenReceipts = receipts.filter(r => r.status === 'SEEN');
        const deliveredReceipts = receipts.filter(r => r.status === 'DELIVERED');
        const sentReceipts = receipts.filter(r => r.status === 'SENT');

        let html = `<div class="receipt-modal-header">
            <h3>Message Info</h3>
            <button class="receipt-close-btn" onclick="document.getElementById('receipt-modal-overlay').classList.add('hidden')">✕</button>
        </div>`;

        if (seenReceipts.length > 0) {
            html += `<div class="receipt-section">
                <div class="receipt-section-title">
                    <span class="message-status seen">✓✓</span> Read by
                </div>`;
            seenReceipts.forEach(r => {
                const seenTime = r.seenAt ? new Date(r.seenAt).toLocaleString([], { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }) : '';
                html += `<div class="receipt-item">
                    <span class="receipt-name">${escapeHtml(r.displayName)}</span>
                    <span class="receipt-time">${seenTime}</span>
                </div>`;
            });
            html += `</div>`;
        }

        if (deliveredReceipts.length > 0) {
            html += `<div class="receipt-section">
                <div class="receipt-section-title">
                    <span class="message-status delivered">✓✓</span> Delivered to
                </div>`;
            deliveredReceipts.forEach(r => {
                const deliveredTime = r.deliveredAt ? new Date(r.deliveredAt).toLocaleString([], { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }) : '';
                html += `<div class="receipt-item">
                    <span class="receipt-name">${escapeHtml(r.displayName)}</span>
                    <span class="receipt-time">${deliveredTime}</span>
                </div>`;
            });
            html += `</div>`;
        }

        if (sentReceipts.length > 0) {
            html += `<div class="receipt-section">
                <div class="receipt-section-title">
                    <span class="message-status sent">✓</span> Not yet delivered
                </div>`;
            sentReceipts.forEach(r => {
                html += `<div class="receipt-item">
                    <span class="receipt-name">${escapeHtml(r.displayName)}</span>
                    <span class="receipt-time">—</span>
                </div>`;
            });
            html += `</div>`;
        }

        if (receipts.length === 0) {
            html += `<div class="receipt-section"><p style="text-align:center;color:#94a3b8;">No receipt data available</p></div>`;
        }

        modal.innerHTML = html;
        overlay.classList.remove('hidden');

    } catch (error) {
        console.error('Error loading receipts:', error);
        showToast('Could not load receipt info', 'error');
    }
}
