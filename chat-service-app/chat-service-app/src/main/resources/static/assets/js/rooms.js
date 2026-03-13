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
        roomElement.dataset.roomId = room.id;
        roomElement.style.cssText = 'display:flex;align-items:center;gap:0.75rem;';
        roomElement.onclick = (e) => app.selectRoom(room.id, room.name, room.roomType, e);

        const displayName = room.name;

        // Default avatar image based on room type
        const defaultImg = (room.roomType === 'DIRECT_MESSAGE')
            ? 'assets/Images/defaultProfileImage.png'
            : 'assets/Images/defaultProfileImageGroups.png';

        // Status dot for DM rooms (green=online, grey=offline)
        const statusDotHtml = (room.roomType === 'DIRECT_MESSAGE')
            ? `<span class="dm-status-dot" data-room-id="${room.id}" style="position:absolute;bottom:0;right:0;width:10px;height:10px;border-radius:50%;background:#9ca3af;border:2px solid white;z-index:2;"></span>`
            : '';

        let lastMsgHtml = '';
        if (room.lastMessage) {
            const shortText = `${room.lastMessage.senderName}: ${room.lastMessage.text}`;
            lastMsgHtml = `<div class="room-last-message" style="font-size:0.8rem;color:inherit;opacity:0.8;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(shortText)}</div>`;
        }

        roomElement.innerHTML = `
            <div class="room-item-avatar" style="position:relative;flex-shrink:0;">
                <img src="${defaultImg}" alt="" class="room-avatar-img" data-room-id="${room.id}" style="width:42px;height:42px;border-radius:50%;object-fit:cover;">
                ${statusDotHtml}
            </div>
            <div style="flex:1;min-width:0;">
                <div class="room-item-header">
                    <div class="room-name">${escapeHtml(displayName)}</div>
                </div>
                ${lastMsgHtml}
            </div>
        `;

        roomList.appendChild(roomElement);

        // Fetch online status and profile pic for DM rooms
        if (room.roomType === 'DIRECT_MESSAGE') {
            fetchDmStatusAndAvatar(app, room.id, roomElement);
        }
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

/**
 * Search public rooms by name query.
 */
export async function searchPublicRooms(app, query) {
    try {
        const response = await fetch(`/api/rooms/search?query=${encodeURIComponent(query)}`, {
            headers: { 'Authorization': 'Bearer ' + app.token }
        });
        if (response.ok) {
            const rooms = await response.json();
            displayAvailableRooms(app, rooms);
        }
    } catch (error) {
        console.error('Error searching rooms:', error);
    }
}

function displayAvailableRooms(app, rooms) {
    const availableRooms = document.getElementById('available-rooms');
    availableRooms.innerHTML = '';

    if (rooms.length === 0) {
        availableRooms.innerHTML = '<div class="no-rooms">No public rooms found</div>';
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
                <span>${room.memberCount != null ? room.memberCount + ' members' : room.roomType.replace('_', ' ')}</span>
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

    // After members loaded, update chat header avatar for DMs
    if (roomType === 'DIRECT_MESSAGE' && app.currentRoomOtherMember) {
        const otherMember = app.currentRoomOtherMember;
        try {
            const profileResp = await fetch(`/api/profiles/${otherMember.userId || otherMember.id}`, {
                headers: { 'Authorization': 'Bearer ' + app.token }
            });
            if (profileResp.ok) {
                const profile = await profileResp.json();
                if (profile.avatarUrl && headerAvatar) {
                    headerAvatar.innerHTML = `<img src="${profile.avatarUrl}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
                }
            }
        } catch (e) {
            console.warn('Could not fetch DM user profile pic for header:', e);
        }
    } else if (roomType !== 'DIRECT_MESSAGE' && headerAvatar) {
        headerAvatar.innerHTML = `<img src="assets/Images/defaultProfileImageGroups.png" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
    }

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
    const password = document.getElementById('room-password')?.value.trim() || null;

    if (!name) {
        showToast('Room name is required', 'error');
        return;
    }

    if (isPrivate && !password) {
        showToast('Password is required for private rooms', 'error');
        return;
    }

    try {
        const response = await fetch('/api/rooms', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + app.token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, description, roomType, isPrivate, password })
        });

        if (response.ok) {
            const data = await response.json();
            closeModals();
            loadMyRooms(app);
            loadAvailableRooms(app);

            // If private room created, show the invite token info
            if (data.inviteToken) {
                const inviteLink = `${window.location.origin}/chat.html?joinToken=${data.inviteToken}`;
                showToast('Private room created! Invite link copied to clipboard.', 'success', 5000);
                navigator.clipboard.writeText(inviteLink).catch(() => {});
            } else {
                showToast('Room created successfully!', 'success');
            }

            document.getElementById('room-name').value = '';
            document.getElementById('room-description').value = '';
            document.getElementById('room-private').checked = false;
            if (document.getElementById('room-password')) document.getElementById('room-password').value = '';
            if (document.getElementById('room-password-section')) document.getElementById('room-password-section').style.display = 'none';
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

/**
 * Fetch DM other user's online status and profile picture, updating the sidebar.
 */
async function fetchDmStatusAndAvatar(app, roomId, roomElement) {
    try {
        const response = await fetch(`/api/rooms/${roomId}/members`, {
            headers: { 'Authorization': 'Bearer ' + app.token }
        });
        if (response.ok) {
            const data = await response.json();
            const members = data.members || data;
            const otherMember = members.find(m => m.username !== app.currentUser.username);
            if (otherMember) {
                // Update status dot
                const dot = roomElement.querySelector('.dm-status-dot');
                if (dot) {
                    dot.style.background = otherMember.status === 'ONLINE' ? '#22c55e' : '#9ca3af';
                }

                // Fetch profile picture for the other user
                try {
                    const profileResp = await fetch(`/api/profiles/${otherMember.userId || otherMember.id}`, {
                        headers: { 'Authorization': 'Bearer ' + app.token }
                    });
                    if (profileResp.ok) {
                        const profile = await profileResp.json();
                        if (profile.avatarUrl) {
                            const avatarImg = roomElement.querySelector('.room-avatar-img');
                            if (avatarImg) {
                                avatarImg.src = profile.avatarUrl;
                            }
                        }
                    }
                } catch (e) {
                    console.warn('Could not fetch DM user profile pic:', e);
                }
            }
        }
    } catch (e) {
        console.warn('Could not fetch DM status for room:', roomId);
    }
}

/**
 * Update the DM status dot in the sidebar for a specific room.
 */
export function updateDmStatusDot(roomId, status) {
    const dot = document.querySelector(`.dm-status-dot[data-room-id="${roomId}"]`);
    if (dot) {
        dot.style.background = status === 'ONLINE' ? '#22c55e' : '#9ca3af';
    }
}

/**
 * Delete a room (creator only, admin if creator left).
 */
export async function deleteRoom(app, roomId) {
    const targetRoom = roomId || app.currentRoom;
    if (!targetRoom) return;

    if (!confirm('Are you sure you want to DELETE this room? All messages will be permanently removed.')) return;

    try {
        const response = await fetch(`/api/rooms/${targetRoom}`, {
            method: 'DELETE',
            headers: {
                'Authorization': 'Bearer ' + app.token
            }
        });

        if (response.ok) {
            showToast('Room deleted successfully', 'success');
            loadMyRooms(app);

            if (app.currentRoom === targetRoom) {
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
        } else {
            const error = await response.json();
            showToast(error.error || 'Failed to delete room', 'error');
        }
    } catch (error) {
        console.error('Error deleting room:', error);
        showToast('Network error. Please try again.', 'error');
    }
}

/**
 * Clear all messages in a room (admin can do server-side clear for everyone).
 * Regular users do a client-side clear only.
 */
export async function clearChat(app, roomId) {
    const targetRoom = roomId || app.currentRoom;
    if (!targetRoom) return;

    if (!confirm('Clear all messages in this chat?')) return;

    try {
        const response = await fetch(`/api/rooms/${targetRoom}/messages`, {
            method: 'DELETE',
            headers: {
                'Authorization': 'Bearer ' + app.token
            }
        });

        if (response.ok) {
            showToast('Chat cleared', 'success');
            // Clear the message area if viewing this room
            if (app.currentRoom === targetRoom) {
                document.getElementById('chat-messages').innerHTML = '';
            }
        } else {
            const error = await response.json();
            // If not admin, do client-side clear
            if (response.status === 403) {
                if (app.currentRoom === targetRoom) {
                    document.getElementById('chat-messages').innerHTML = '';
                    showToast('Chat cleared locally', 'info');
                }
            } else {
                showToast(error.error || 'Failed to clear chat', 'error');
            }
        }
    } catch (error) {
        console.error('Error clearing chat:', error);
        showToast('Network error', 'error');
    }
}

/**
 * Join a private room using room ID and password.
 */
export async function joinRoomWithPassword(app, roomId, password) {
    if (!roomId || !password) {
        showToast('Room ID and password are required', 'error');
        return;
    }

    try {
        const response = await fetch(`/api/rooms/${roomId}/join`, {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + app.token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ password })
        });

        if (response.ok) {
            closeModals();
            loadMyRooms(app);
            showToast('Joined private room successfully!', 'success');
        } else {
            const error = await response.json();
            showToast(error.error || 'Failed to join room', 'error');
        }
    } catch (error) {
        console.error('Error joining private room:', error);
        showToast('Network error. Please try again.', 'error');
    }
}

/**
 * Join a room using an invite token.
 */
export async function joinRoomByToken(app, token) {
    if (!token) {
        showToast('Invite token is required', 'error');
        return;
    }

    // Extract token from full URL if pasted
    try {
        const url = new URL(token);
        const tokenParam = url.searchParams.get('joinToken');
        if (tokenParam) token = tokenParam;
    } catch (e) {
        // Not a URL, treat as raw token — that's fine
    }

    try {
        const response = await fetch(`/api/rooms/join-by-token?token=${encodeURIComponent(token)}`, {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + app.token,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const data = await response.json();
            closeModals();
            loadMyRooms(app);
            showToast(`Joined room "${data.roomName}" successfully!`, 'success');

            // Open the room
            selectRoom(app, data.roomId, data.roomName, 'GROUP_CHAT');
        } else {
            const error = await response.json();
            showToast(error.error || 'Invalid or expired invite link', 'error');
        }
    } catch (error) {
        console.error('Error joining by invite:', error);
        showToast('Network error. Please try again.', 'error');
    }
}

/**
 * Check URL for invite link token on page load and auto-join.
 */
export function checkInviteLink(app) {
    const urlParams = new URLSearchParams(window.location.search);
    const joinToken = urlParams.get('joinToken');
    if (joinToken) {
        // Clean the URL
        const cleanUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
        // Auto-join after a short delay to ensure WebSocket is connected
        setTimeout(() => joinRoomByToken(app, joinToken), 1000);
    }
}
