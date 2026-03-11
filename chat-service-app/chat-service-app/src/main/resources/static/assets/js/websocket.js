/**
 * WebSocket Module - Manages STOMP/WebSocket connection and subscriptions.
 */
import { showToast } from './ui.js';
import { bubbleRoomToTop } from './messages.js';
import { updateDmStatusDot, loadMyRooms } from './rooms.js';

/**
 * Connect to WebSocket server via SockJS + STOMP.
 */
export function connectWebSocket(app) {
    if (app.stompClient && app.stompClient.connected) {
        return; // Already connected
    }
    if (app.stompClient) {
        try { app.stompClient.disconnect(); } catch (e) { /* ignore */ }
    }

    const socket = new SockJS('/ws');
    app.stompClient = Stomp.over(socket);

    app.stompClient.connect(
        { 'Authorization': 'Bearer ' + app.token },
        (frame) => {
            console.log('Connected: ' + frame);
            onWebSocketConnected(app);
            updateUserStatus(app, 'ONLINE');
            markAllDeliveredOnConnect(app);
            const statusSelect = document.getElementById('status-select');
            if (statusSelect) statusSelect.value = 'ONLINE';
        },
        (error) => {
            console.error('WebSocket connection error:', error);
            showToast('Connection failed. Retrying...', 'error');
            setTimeout(() => connectWebSocket(app), 5000);
        }
    );
}

function onWebSocketConnected(app) {
    // Subscribe to user-specific channels
    app.stompClient.subscribe('/user/topic/user-status/' + app.currentUser.username, (message) => {
        const statusUpdate = JSON.parse(message.body);
        console.log('Status update:', statusUpdate);
    });

    // Subscribe to error messages
    app.stompClient.subscribe('/user/queue/errors', (message) => {
        const error = JSON.parse(message.body);
        console.error('WebSocket error:', error);
        showToast('Error: ' + error.message, 'error');
    });

    // Subscribe to global notifications for incoming messages in unopened rooms
    app.stompClient.subscribe('/user/queue/notifications', (message) => {
        const notification = JSON.parse(message.body);
        if (notification.type === 'NEW_MESSAGE') {
            console.log('Got global notification for room: ' + notification.roomId);
            if (notification.roomId !== app.currentRoom) {
                bubbleRoomToTop(notification.roomId);
            }
        }
    });

    showToast('Connected successfully!', 'success');
}

/**
 * Subscribe to a specific room's channels (messages, events, typing, status).
 */
export function subscribeToRoom(app, roomId) {
    unsubscribeFromRoom(app);

    // Subscribe to room messages
    const msgSub = app.stompClient.subscribe('/topic/rooms/' + roomId, (message) => {
        const messageData = JSON.parse(message.body);
        app.displayMessage(messageData);
    });
    app.roomSubscriptions.push(msgSub);

    // Subscribe to room events
    const eventSub = app.stompClient.subscribe('/topic/rooms/' + roomId + '/events', (message) => {
        const event = JSON.parse(message.body);

        if (event.type === 'ROOM_DELETED') {
            // Room was deleted - remove from sidebar and reset view if current
            showToast(event.message || 'Room was deleted', 'info');
            loadMyRooms(app);
            if (app.currentRoom === roomId) {
                app.currentRoom = null;
                document.getElementById('current-room-name').textContent = 'Select a room to start chatting';
                document.getElementById('chat-input-area').classList.add('hidden');
                document.getElementById('chat-messages').innerHTML = `
                    <div class="welcome-message">
                        <i class="fas fa-comments"></i>
                        <h3>Welcome to ChatService</h3>
                        <p>Select a room from the sidebar to start chatting</p>
                    </div>
                `;
                const membersPanel = document.getElementById('members-panel');
                if (membersPanel) membersPanel.classList.add('hidden');
            }
            return;
        }

        if (event.type === 'MESSAGES_CLEARED') {
            if (app.currentRoom === roomId) {
                document.getElementById('chat-messages').innerHTML = '';
            }
            showToast(event.message || 'Chat was cleared', 'info');
            return;
        }

        if (event.type === 'MESSAGE_DELETED' && event.messageId) {
            const msgEl = document.getElementById('msg-' + event.messageId);
            if (msgEl) msgEl.remove();
            loadMyRooms(app);
            return;
        }

        if (event.type === 'MESSAGE_EDITED' && event.messageId) {
            const msgEl = document.getElementById('msg-' + event.messageId);
            if (msgEl) {
                const textEl = msgEl.querySelector('.message-text');
                if (textEl) {
                    textEl.textContent = event.text;
                    let metaEl = msgEl.querySelector('.message-meta');
                    if (!metaEl) {
                        metaEl = document.createElement('div');
                        metaEl.className = 'message-meta';
                        msgEl.querySelector('.message-content').appendChild(metaEl);
                    }
                    if (!metaEl.querySelector('.edited-label')) {
                        const editedLabel = document.createElement('span');
                        editedLabel.className = 'edited-label';
                        editedLabel.textContent = '(edited)';
                        editedLabel.style.fontSize = '0.7em';
                        editedLabel.style.opacity = '0.7';
                        editedLabel.style.marginRight = '4px';
                        metaEl.prepend(editedLabel);
                    }
                }
            }
            loadMyRooms(app);
            return;
        }

        // Handle STATUS_UPDATE for DM sidebar dot
        if (event.type === 'STATUS_UPDATE' && event.roomId) {
            updateDmStatusDot(event.roomId, event.user.status);
        }

        app.displayEvent(event);
    });
    app.roomSubscriptions.push(eventSub);

    // Subscribe to typing indicators
    const typingSub = app.stompClient.subscribe('/topic/rooms/' + roomId + '/typing', (message) => {
        const typing = JSON.parse(message.body);
        app.displayTyping(typing);
    });
    app.roomSubscriptions.push(typingSub);

    // Subscribe to message status updates (tick marks)
    const statusSub = app.stompClient.subscribe('/topic/rooms/' + roomId + '/status', (message) => {
        const statusUpdate = JSON.parse(message.body);
        if (statusUpdate.type === 'MESSAGE_STATUS_UPDATE') {
            app.updateMessageStatuses(statusUpdate.messageIds, statusUpdate.newStatus);
        }
    });
    app.roomSubscriptions.push(statusSub);
}

/**
 * Unsubscribe from all current room subscriptions.
 */
export function unsubscribeFromRoom(app) {
    if (app.roomSubscriptions) {
        app.roomSubscriptions.forEach(sub => {
            if (sub) sub.unsubscribe();
        });
    }
    app.roomSubscriptions = [];
}

/**
 * Send user status update via WebSocket.
 */
export function updateUserStatus(app, status) {
    if (app.stompClient && app.stompClient.connected) {
        app.stompClient.send('/app/user/status', {},
            JSON.stringify({ status: status }));
    }
}

/**
 * Call REST endpoint to mark all pending messages as DELIVERED on connect.
 */
function markAllDeliveredOnConnect(app) {
    fetch('/api/messages/mark-delivered-all', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + app.token }
    }).then(response => {
        if (response.ok) {
            console.log('✅ Marked all pending messages as delivered');
        }
    }).catch(err => {
        console.error('Error marking delivered on connect:', err);
    });
}
