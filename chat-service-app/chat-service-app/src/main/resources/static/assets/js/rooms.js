/**
 * Rooms Module - Handles room creation, joining, leaving, loading, and selection.
 */
import { escapeHtml, showToast, showModal, closeModals } from './ui.js';
import { subscribeToRoom, unsubscribeFromRoom } from './websocket.js';
import { loadMessages } from './messages.js';
import { loadRoomMembers } from './members.js';

/**
 * Load "My Rooms" sidebar list.
 */
export async function loadMyRooms(app) {
    try {
        const response = await fetch('/api/rooms/my-rooms', {
            headers: { 'Authorization': 'Bearer ' + app.token }
        });
        if (response.ok) {
            const rooms = await response.json();
            displayMyRooms(app, rooms);
        }
    } catch (error) {
        console.error('Error loading rooms:', error);
    }
}

/**
 * Render the list of rooms in the sidebar.
 */
function displayMyRooms(app, rooms) {
    const roomList = document.getElementById('room-list');
    roomList.innerHTML = '';

    if (rooms.length === 0) {
        roomList.innerHTML = '<div class="no-rooms">No rooms joined yet</div>';
        return;
    }

    rooms.forEach(membership => {
        const room = membership.room;
        const roomElement = document.createElement('div');
        roomElement.className = 'room-item';
        roomElement.onclick = (e) => app.selectRoom(room.id, room.name, room.roomType, e);

        const displayName = room.name;

        // Hide description for Direct Messages
        const descriptionHtml = (room.roomType === 'DIRECT_MESSAGE') ? '' :
            (room.description ? `<div class="room-description">${escapeHtml(room.description)}</div>` : '');

        roomElement.innerHTML = `
            <div class="room-item-header">
                <div class="room-name">${escapeHtml(displayName)}</div>
                <div class="room-actions-btn">
                    <button class="btn-icon" onclick="event.stopPropagation(); chatApp.leaveRoom('${room.id}')" title="Leave Room">
                        <i class="fas fa-sign-out-alt"></i>
                    </button>
                </div>
            </div>
            <div class="room-type">${room.roomType.replace('_', ' ')}</div>
            ${descriptionHtml}
        `;

        roomList.appendChild(roomElement);
    });
}

/**
 * Load available public rooms for the Join modal.
 */
export async function loadAvailableRooms(app) {
    try {
        const response = await fetch('/api/rooms/available', {
            headers: { 'Authorization': 'Bearer ' + app.token }
        });
        if (response.ok) {
            const rooms = await response.json();
            displayAvailableRooms(app, rooms);
        }
    } catch (error) {
        console.error('Error loading available rooms:', error);
    }
}

function displayAvailableRooms(app, rooms) {
    const availableRooms = document.getElementById('available-rooms');
    availableRooms.innerHTML = '';

    if (rooms.length === 0) {
        availableRooms.innerHTML = '<div class="no-rooms">No public rooms available</div>';
        return;
    }

    rooms.forEach(room => {
        const roomElement = document.createElement('div');
        roomElement.className = 'available-room-item';
        roomElement.onclick = (e) => { e.stopPropagation && e.stopPropagation(); joinRoom(app, room.id); };

        roomElement.innerHTML = `
            <div class="room-item-name">${escapeHtml(room.name)}</div>
            ${room.description ? `<div class="room-item-desc">${escapeHtml(room.description)}</div>` : ''}
            <div class="room-item-meta">
                <span>${room.roomType.replace('_', ' ')}</span>
                <button class="btn-primary btn-small" onclick="event.stopPropagation(); chatApp.joinRoom('${room.id}')">
                    Join Room
                </button>
            </div>
        `;

        availableRooms.appendChild(roomElement);
    });
}

/**
 * Select and open a room.
 */
export async function selectRoom(app, roomId, roomName, roomType, e = null) {
    // Unsubscribe from previous room
    if (app.currentRoom) {
        unsubscribeFromRoom(app);
    }

    app.currentRoom = roomId;
    app.currentRoomType = roomType;

    // Update room name
    const currentRoomNameEl = document.getElementById('current-room-name');
    if (currentRoomNameEl) currentRoomNameEl.textContent = roomName;

    // ---- Static buttons from HTML ----
    const roomHeaderBtn   = document.getElementById('chat-header-room-btn');
    const headerAvatar    = document.getElementById('chat-header-avatar');
    const statusIndicator = document.getElementById('room-status-indicator');
    const renameBtn       = document.getElementById('rename-room-btn');
    const infoBtn         = document.getElementById('chat-header-info-btn');
    const membersPanel    = document.getElementById('members-panel');

    if (roomType === 'DIRECT_MESSAGE') {
        // DM: room button opens user profile, avatar shows person icon
        if (headerAvatar)    headerAvatar.innerHTML = '<i class="fas fa-user"></i>';
        if (statusIndicator) statusIndicator.textContent = 'Click to view profile';

        // Wire room button to show DM user details
        if (roomHeaderBtn) {
            roomHeaderBtn.onclick = () => {
                if (app.currentRoomOtherMember) {
                    app._showUserDetailsModal(app.currentRoomOtherMember);
                } else {
                    showToast('User details are still loading...', 'info');
                }
            };
        }

        // Show Info button in header, hide rename
        if (infoBtn)    infoBtn.style.display    = 'inline-flex';
        if (renameBtn)  renameBtn.style.display  = 'none';

        // Ensure members panel is closed for DMs
        if (membersPanel) membersPanel.classList.add('hidden');

    } else {
        // GROUP: room button toggles the Members panel
        if (headerAvatar)    headerAvatar.innerHTML = '<i class="fas fa-users"></i>';
        if (statusIndicator) statusIndicator.textContent = 'Click to see members';

        // Wire room button to toggle members panel
        if (roomHeaderBtn) {
            roomHeaderBtn.onclick = () => {
                if (membersPanel) membersPanel.classList.toggle('hidden');
            };
        }

        // Show Rename button in header, hide Info (DM-only)
        if (renameBtn) renameBtn.style.display = 'inline-flex';
        if (infoBtn)   infoBtn.style.display   = 'none';
    }

    // Wire Rename button
    if (renameBtn) {
        renameBtn.onclick = () => app.showRenameRoom();
    }

    // Wire DM Info button
    if (infoBtn) {
        infoBtn.onclick = () => {
            if (app.currentRoomOtherMember) {
                app._showUserDetailsModal(app.currentRoomOtherMember);
            } else {
                showToast('User details are still loading...', 'info');
            }
        };
    }

    document.getElementById('chat-input-area')?.classList.remove('hidden');

    // Update active room styling in sidebar
    document.querySelectorAll('.room-item').forEach(item => item.classList.remove('active'));
    try {
        const roomItemEl = e && (e.currentTarget || e.target)
            ? (e.currentTarget || e.target).closest('.room-item')
            : null;
        if (roomItemEl) roomItemEl.classList.add('active');
    } catch (err) {
        console.warn('Could not set active class', err);
    }

    // Subscribe to room WebSocket channels
    if (app.stompClient && app.stompClient.connected) {
        subscribeToRoom(app, roomId);
    }

    // Load members and messages
    await Promise.all([
        loadRoomMembers(app, roomId),
        loadMessages(app, roomId)
    ]);

    // Clear welcome message
    const welcomeMessage = document.querySelector('.welcome-message');
    if (welcomeMessage) welcomeMessage.style.display = 'none';
}

/**
 * Create a new room.
 */
export async function createRoom(app) {
    const name = document.getElementById('room-name').value.trim();
    const description = document.getElementById('room-description').value.trim();
    const roomType = document.getElementById('room-type').value;
    const isPrivate = document.getElementById('room-private').checked;

    if (!name) {
        showToast('Room name is required', 'error');
        return;
    }

    try {
        const response = await fetch('/api/rooms', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + app.token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, description, roomType, isPrivate })
        });

        if (response.ok) {
            closeModals();
            loadMyRooms(app);
            loadAvailableRooms(app);
            showToast('Room created successfully!', 'success');

            document.getElementById('room-name').value = '';
            document.getElementById('room-description').value = '';
            document.getElementById('room-private').checked = false;
        } else {
            const error = await response.json();
            showToast(error.error || 'Failed to create room', 'error');
        }
    } catch (error) {
        console.error('Error creating room:', error);
        showToast('Network error. Please try again.', 'error');
    }
}

/**
 * Join an existing room.
 */
export async function joinRoom(app, roomId) {
    try {
        const response = await fetch(`/api/rooms/${roomId}/join`, {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + app.token,
                'Content-Type': 'application/json'
            },
        });

        if (response.ok) {
            closeModals();
            loadMyRooms(app);
            showToast('Joined room successfully!', 'success');
        } else {
            const error = await response.json();
            showToast(error.error || 'Failed to join room', 'error');
        }
    } catch (error) {
        console.error('Error joining room:', error);
        showToast('Network error. Please try again.', 'error');
    }
}

/**
 * Leave a room.
 */
export async function leaveRoom(app, roomId) {
    if (!confirm('Are you sure you want to leave this room?')) return;

    try {
        const response = await fetch(`/api/rooms/${roomId}/leave`, {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + app.token,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            loadMyRooms(app);
            showToast('Left room successfully!', 'success');

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
            }
        } else {
            const error = await response.json();
            showToast(error.error || 'Failed to leave room', 'error');
        }
    } catch (error) {
        console.error('Error leaving room:', error);
        showToast('Network error. Please try again.', 'error');
    }
}

/**
 * Start a direct message conversation.
 */
export async function startDirectMessage(app) {
    const phoneNumber = document.getElementById('dm-phone')?.value.trim();
    const username = document.getElementById('dm-username')?.value.trim();

    if (!phoneNumber && !username) {
        showToast('Please enter a phone number or username', 'error');
        return;
    }

    try {
        const response = await fetch('/api/rooms/direct-message', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + app.token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                phoneNumber: phoneNumber || null,
                username: username || null
            })
        });

        if (response.ok) {
            const room = await response.json();
            closeModals();
            loadMyRooms(app);

            document.getElementById('dm-phone').value = '';
            document.getElementById('dm-username').value = '';

            selectRoom(app, room.id, room.name, room.roomType);
            showToast('Direct message started!', 'success');
        } else {
            const error = await response.json();
            showToast(error.error || 'User not found', 'error');
        }
    } catch (error) {
        console.error('Error starting direct message:', error);
        showToast('Failed to start direct message', 'error');
    }
}

/**
 * Rename a room (or set a nickname for DMs).
 */
export async function renameRoom(app) {
    const newName = document.getElementById('rename-room-input').value.trim();
    if (!newName || !app.currentRoom) return;

    if (app.currentRoomType === 'DIRECT_MESSAGE') {
        localStorage.setItem('room_alias_' + app.currentRoom, newName);
        document.getElementById('current-room-name').textContent = newName;
        showToast('Chat nickname set successfully', 'success');
        closeModals();
        loadMyRooms(app);
        return;
    }

    try {
        const response = await fetch(`/api/rooms/${app.currentRoom}/rename`, {
            method: 'PUT',
            headers: {
                'Authorization': 'Bearer ' + app.token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name: newName })
        });

        if (response.ok) {
            const data = await response.json();
            document.getElementById('current-room-name').textContent = data.name;
            showToast('Room renamed', 'success');
            closeModals();
            loadMyRooms(app);
        } else {
            const error = await response.json();
            showToast(error.error || 'Failed to rename room', 'error');
        }
    } catch (error) {
        console.error('Renaming error:', error);
        showToast('Network error', 'error');
    }
}
