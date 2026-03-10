/**
 * WebSocket Module - Manages STOMP/WebSocket connection and subscriptions.
 */
import { showToast } from './ui.js';

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
