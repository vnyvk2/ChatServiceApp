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
        messageElement.dataset.createdAt = messageData.createdAt || new Date().toISOString();

        const showTime = timeString !== lastMessageTime;
        lastMessageTime = timeString;

        const senderDisplayName = messageData.sender ? escapeHtml(messageData.sender.displayName) : 'Unknown User';
        const messageText = messageData.text ? escapeHtml(messageData.text) : '...';
        const messageStatus = messageData.status || messageData.messageStatus || 'SENT';
        const ticks = getStatusTicks(messageStatus, isOwnMessage);
        const editedLabel = messageData.editedAt ? `<span class="edited-label" style="font-size:0.7em;opacity:0.7;margin-right:4px;">(edited)</span>` : '';

        messageElement.innerHTML = `
            <div class="message-content">
                <div class="message-header">
                    <span class="message-sender">${senderDisplayName}</span>
                    ${showTime ? `<span class="message-time">${timeString}</span>` : ''}
                </div>
                <div class="message-text">${messageText}</div>
                ${(ticks || editedLabel) ? `<div class="message-meta">${editedLabel}${ticks}</div>` : ''}
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
    messageElement.dataset.createdAt = date.toISOString(); // Always store as ISO string for reliable parsing

    const lastMessageElement = messageArea.lastElementChild;
    const lastTime = lastMessageElement ? lastMessageElement.dataset.timestamp : null;
    const showTime = timestamp !== lastTime;

    const initials = messageData.sender.displayName.split(' ').map(n => n[0]).join('').toUpperCase();
    const messageStatus = messageData.messageStatus || messageData.status || 'SENT';
    const ticks = getStatusTicks(messageStatus, isOwnMessage);
    const editedLabel = messageData.editedAt ? `<span class="edited-label" style="font-size:0.7em;opacity:0.7;margin-right:4px;">(edited)</span>` : '';

    messageElement.innerHTML = `
        <div class="message-avatar">${initials}</div>
        <div class="message-content">
            <div class="message-header">
                <span class="message-sender">${escapeHtml(messageData.sender.displayName)}</span>
                ${showTime ? `<span class="message-time">${timestamp}</span>` : ''}
            </div>
            <div class="message-text">${escapeHtml(messageData.text)}</div>
            ${(ticks || editedLabel) ? `<div class="message-meta">${editedLabel}${ticks}</div>` : ''}
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
        updateSidebarLastMessage(messageData.roomId, messageData.sender.displayName, messageData.text);
    }
}

export function updateSidebarLastMessage(roomId, senderName, text) {
    const roomList = document.getElementById('room-list');
    if (!roomList) return;
    const roomItems = roomList.querySelectorAll('.room-item');
    for (const item of roomItems) {
        const onclickAttr = item.getAttribute('onclick') || '';
        if (item.dataset.roomId === roomId || onclickAttr.includes(roomId)) {
            let lastMsgEl = item.querySelector('.room-last-message');
            if (!lastMsgEl) {
                lastMsgEl = document.createElement('div');
                lastMsgEl.className = 'room-last-message';
                lastMsgEl.style.cssText = 'font-size:0.8rem;color:inherit;opacity:0.8;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
                item.appendChild(lastMsgEl);
            }
            lastMsgEl.textContent = `${senderName}: ${text}`;
            break;
        }
    }
}

/**
 * Move a room item to the top of the sidebar room list.
 */
export function bubbleRoomToTop(roomId) {
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

    if (app.editingMessageId) {
        const editingId = app.editingMessageId; // Store local copy
        // Send edit request instead of sending a new message
        fetch(`/api/messages/rooms/${app.currentRoom}/messages/${editingId}`, {
            method: 'PUT',
            headers: {
                'Authorization': 'Bearer ' + app.token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ content: text })
        }).then(res => {
            if (!res.ok) {
                res.json().then(data => showToast(data.error || 'Failed to edit', 'error'));
            } else {
                // Only clear input and state on suspected success (event will update UI)
                app.editingMessageId = null;
                messageInput.value = '';
                const sendBtn = document.getElementById('send-btn');
                if (sendBtn) sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
                const cancelEditBtn = document.getElementById('cancel-edit-btn');
                if (cancelEditBtn) cancelEditBtn.remove();
            }
        }).catch(err => {
            console.error(err);
            showToast('Network error', 'error');
        });
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

        const msgEl = document.getElementById('msg-' + messageId);
        const createdAtStr = msgEl ? msgEl.dataset.createdAt : null;
        const msgDate = createdAtStr ? new Date(isNaN(createdAtStr) ? createdAtStr : Number(createdAtStr)) : new Date();
        const isRecent = !isNaN(msgDate.getTime()) && (new Date() - msgDate) < (5 * 60 * 1000);

        html += `<div class="modal-actions" style="margin-top: 1rem; border-top: 1px solid var(--border-light); padding-top: 1rem; display: flex; flex-direction: column; gap: 0.5rem;">
            ${isRecent ? `<button class="btn-primary btn-small" onclick="chatApp.promptEditMessage('${messageId}')" style="width:100%;"><i class="fas fa-edit"></i> Edit</button>` : ''}
            <button class="btn-danger-ghost btn-small" onclick="chatApp.promptDeleteMessage('${messageId}')" style="width:100%;"><i class="fas fa-trash"></i> Delete</button>
        </div>`;

        modal.innerHTML = html;
        overlay.classList.remove('hidden');

    } catch (error) {
        console.error('Error loading receipts:', error);
        showToast('Could not load receipt info', 'error');
    }
}

/**
 * Prompt user to edit a message
 */
export async function promptEditMessage(app, messageId) {
    const msgEl = document.getElementById('msg-' + messageId);
    if (!msgEl) return;
    const currentText = msgEl.querySelector('.message-text').textContent;
    
    // Hide info modal
    const overlay = document.getElementById('receipt-modal-overlay');
    if (overlay) overlay.classList.add('hidden');

    app.editingMessageId = messageId;
    const messageInput = document.getElementById('message-input');
    messageInput.value = currentText;
    messageInput.focus();

    const sendBtn = document.getElementById('send-btn');
    if (sendBtn) sendBtn.innerHTML = '<i class="fas fa-check"></i>';

    const inputArea = document.getElementById('chat-input-area');
    if (!document.getElementById('cancel-edit-btn')) {
        const cancelBtn = document.createElement('button');
        cancelBtn.id = 'cancel-edit-btn';
        cancelBtn.innerHTML = '<i class="fas fa-times"></i>';
        cancelBtn.className = 'btn-cancel-send';
        cancelBtn.style.cssText = 'background:none;border:none;color:#ef4444;font-size:1.2rem;cursor:pointer;padding:0 10px;';
        cancelBtn.title = "Cancel Edit";
        cancelBtn.onclick = () => {
            app.editingMessageId = null;
            messageInput.value = '';
            if (sendBtn) sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
            cancelBtn.remove();
        };
        inputArea.appendChild(cancelBtn);
    }
}

/**
 * Prompt user to delete a message 
 */
export async function promptDeleteMessage(app, messageId) {
    const msgEl = document.getElementById('msg-' + messageId);
    if (!msgEl) return;
    
    // Hide info modal
    const overlay = document.getElementById('receipt-modal-overlay');
    if (overlay) overlay.classList.add('hidden');
    
    const createdAtStr = msgEl.dataset.createdAt;
    const msgDate = createdAtStr ? new Date(isNaN(createdAtStr) ? createdAtStr : Number(createdAtStr)) : new Date();
    const isRecent = !isNaN(msgDate.getTime()) && (new Date() - msgDate) < (5 * 60 * 1000);
    
    // Create WhatsApp-like custom modal
    let confirmOverlay = document.getElementById('custom-confirm-overlay');
    if (!confirmOverlay) {
        confirmOverlay = document.createElement('div');
        confirmOverlay.id = 'custom-confirm-overlay';
        confirmOverlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:19999;display:flex;align-items:center;justify-content:center;';
        document.body.appendChild(confirmOverlay);
    }

    confirmOverlay.innerHTML = `
        <div style="background:white;padding:1.5rem;border-radius:12px;box-shadow:0 10px 15px -3px rgba(0,0,0,0.1);max-width:300px;text-align:center;">
            <p style="margin-top:0;font-weight:500;color:#1e293b;margin-bottom:1.5rem;">Delete message?</p>
            <div style="display:flex;flex-direction:column;gap:0.5rem;">
                <button id="delete-for-me-btn" style="padding:0.6rem;background:white;border:1px solid #e2e8f0;border-radius:8px;color:#1e293b;cursor:pointer;font-weight:500;">Delete for me</button>
                ${isRecent ? `<button id="delete-for-everyone-btn" style="padding:0.6rem;background:white;border:1px solid #e2e8f0;border-radius:8px;color:#ef4444;cursor:pointer;font-weight:500;">Delete for everyone</button>` : ''}
                <button id="cancel-delete-btn" style="padding:0.6rem;background:white;border:1px solid #e2e8f0;border-radius:8px;color:#1e293b;cursor:pointer;font-weight:500;">Cancel</button>
            </div>
        </div>
    `;
    confirmOverlay.style.display = 'flex';

    document.getElementById('cancel-delete-btn').onclick = () => {
        confirmOverlay.style.display = 'none';
    };

    document.getElementById('delete-for-me-btn').onclick = () => {
        performDelete(app, messageId, false);
        confirmOverlay.style.display = 'none';
    };

    const everyoneBtn = document.getElementById('delete-for-everyone-btn');
    if (everyoneBtn) {
        everyoneBtn.onclick = () => {
            performDelete(app, messageId, true);
            confirmOverlay.style.display = 'none';
        }
    }
}

async function performDelete(app, messageId, forEveryone) {
    try {
        const response = await fetch(`/api/rooms/${app.currentRoom}/messages/${messageId}?forEveryone=${forEveryone}`, {
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + app.token }
        });

        if (response.ok) {
            if (!forEveryone) {
                // Manually remove from UI if it was just for me (no WS event will come)
                const msgEl = document.getElementById('msg-' + messageId);
                if (msgEl) msgEl.remove();
            }
        } else {
            const error = await response.json();
            showToast(error.error || 'Failed to delete message', 'error');
        }
    } catch (error) {
        console.error('Error deleting message:', error);
        showToast('Network error', 'error');
    }
}
