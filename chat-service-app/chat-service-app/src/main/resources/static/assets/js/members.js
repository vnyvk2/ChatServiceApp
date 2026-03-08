/**
 * Members Module - Handles loading/displaying room members and Admin actions.
 */
import { escapeHtml, showToast } from './ui.js';

/**
 * Load room members from REST API.
 */
export async function loadRoomMembers(app, roomId) {
    try {
        const response = await fetch(`/api/rooms/${roomId}/members`, {
            headers: { 'Authorization': 'Bearer ' + app.token }
        });

        if (response.ok) {
            const data = await response.json();
            displayRoomMembers(app, data);
        }
    } catch (error) {
        console.error('Error loading members:', error);
    }
}

/**
 * Display room members with admin controls and status indicators.
 */
export function displayRoomMembers(app, data) {
    // Handle both older array response and newer map response
    let members = [];
    let allMembersMuted = false;

    if (Array.isArray(data)) {
        members = data;
    } else if (data && data.members) {
        members = data.members;
        allMembersMuted = data.allMembersMuted === true;
    }

    const onlineUsers = document.getElementById('online-users');
    const membersCount = document.getElementById('room-members-count');

    membersCount.textContent = `${members.length} member${members.length !== 1 ? 's' : ''}`;

    const statusIndicator = document.getElementById('room-status-indicator');
    if (app.currentRoomType === 'DIRECT_MESSAGE') {
        const otherMember = members.find(m => m.username !== app.currentUser.username);
        app.currentRoomOtherMember = otherMember;
        if (otherMember && statusIndicator) {
            if (otherMember.status === 'ONLINE') {
                statusIndicator.textContent = 'Online';
            } else if (otherMember.lastSeenAt) {
                const timestamp = new Date(otherMember.lastSeenAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                statusIndicator.textContent = 'Last seen at ' + timestamp;
            } else {
                statusIndicator.textContent = 'Offline';
            }
        }
    } else {
        if (statusIndicator) statusIndicator.textContent = allMembersMuted ? '🔇 Room Muted' : '';
    }

    // Determine if current user is admin
    const currentUserMemberInfo = members.find(m => m.username === app.currentUser.username);
    const amIAdmin = currentUserMemberInfo && currentUserMemberInfo.role === 'ADMIN';

    // Check our own mute status
    const myCanSend = currentUserMemberInfo ? currentUserMemberInfo.canSendMessages : true;
    const amIMuted = !myCanSend || (allMembersMuted && !amIAdmin);

    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    if (messageInput && sendBtn) {
        if (amIMuted) {
            messageInput.disabled = true;
            sendBtn.disabled = true;
            messageInput.placeholder = "You are muted in this room.";
        } else {
            messageInput.disabled = false;
            sendBtn.disabled = false;
            messageInput.placeholder = "Type a message...";
        }
    }

    // Admin Room Mute Toggle & Rename Option
    let roomMuteToggleHtml = '';
    if (app.currentRoomType === 'GROUP_CHAT' && amIAdmin) {
        roomMuteToggleHtml = `
            <div style="padding: 10px; border-bottom: 1px solid var(--border-light); display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 0.9em; font-weight: 500;">Mute Entire Room</span>
                <label class="switch" style="position: relative; display: inline-block; width: 34px; height: 20px;">
                    <input type="checkbox" id="mute-room-toggle" ${allMembersMuted ? 'checked' : ''} onchange="chatApp.toggleRoomMute()">
                    <span class="slider round" style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: .4s; border-radius: 34px;"></span>
                </label>
            </div>
            <div style="padding: 10px; border-bottom: 1px solid var(--border-light); display: flex; justify-content: center; align-items: center;">
                <button onclick="chatApp.showRenameRoom()" style="font-size: 0.85rem; padding: 6px 12px; border-radius: 4px; border: 1px solid var(--border-light); background: white; cursor: pointer; width: 100%;">
                    <i class="fas fa-pen"></i> Rename Group
                </button>
            </div>
        `;
    }

    onlineUsers.innerHTML = roomMuteToggleHtml;

    members.forEach(member => {
        const memberElement = document.createElement('div');
        memberElement.className = 'member-item';
        memberElement.style.position = 'relative';

        const statusClass = 'status-' + member.status.toLowerCase();
        const initials = member.displayName.split(' ').map(n => n[0]).join('').toUpperCase();

        const isAdmin = member.role === 'ADMIN';
        let roleDisplay = member.role.toLowerCase();
        if (isAdmin) roleDisplay = '👑 ' + roleDisplay;

        let muteDisplay = '';
        if (member.canSendMessages === false) {
            muteDisplay = '<span style="color: #ef4444; font-size: 0.8em; margin-left: 5px;" title="Muted">🔇</span>';
        }

        let adminControls = '';
        if (amIAdmin && member.username !== app.currentUser.username) {
            adminControls = `
                <div class="member-admin-controls" style="margin-top: 8px; display: flex; gap: 5px; flex-wrap: wrap;">
                    <button onclick="chatApp.toggleMemberMute('${member.id}')" style="font-size: 0.75rem; padding: 2px 6px; border-radius: 4px; border: 1px solid #cbd5e1; background: #f8fafc; cursor: pointer;">
                        ${member.canSendMessages === false ? 'Unmute' : 'Mute'}
                    </button>
                    <button onclick="chatApp.toggleAdminRole('${member.id}')" style="font-size: 0.75rem; padding: 2px 6px; border-radius: 4px; border: 1px solid #cbd5e1; background: #f8fafc; cursor: pointer;">
                        ${isAdmin ? 'Demote' : 'Promote'}
                    </button>
                    <button onclick="chatApp.removeMember('${member.id}')" style="font-size: 0.75rem; padding: 2px 6px; border-radius: 4px; border: 1px solid #fca5a5; background: #fef2f2; color: #ef4444; cursor: pointer;">
                        Remove
                    </button>
                </div>
            `;
        }

        memberElement.innerHTML = `
            <div class="member-avatar" style="align-self: flex-start;">
                ${initials}
                <div class="status-indicator ${statusClass}"></div>
            </div>
            <div class="member-info" style="flex: 1;">
                <div class="member-name">${escapeHtml(member.displayName)} ${muteDisplay}</div>
                <div class="member-status">${member.status.toLowerCase()}</div>
                <div class="member-role" style="font-weight: ${isAdmin ? 'bold' : 'normal'}; color: ${isAdmin ? 'var(--primary)' : 'inherit'};">${roleDisplay}</div>
                ${adminControls}
            </div>
        `;

        onlineUsers.appendChild(memberElement);
    });

    // Add minimal CSS for the toggle switch if not present
    if (!document.getElementById('switch-styles')) {
        const style = document.createElement('style');
        style.id = 'switch-styles';
        style.textContent = `
            .switch input { opacity: 0; width: 0; height: 0; }
            .slider:before { position: absolute; content: ""; height: 14px; width: 14px; left: 3px; bottom: 3px; background-color: white; transition: .4s; border-radius: 50%; }
            input:checked + .slider { background-color: var(--primary); }
            input:checked + .slider:before { transform: translateX(14px); }
        `;
        document.head.appendChild(style);
    }
}

// --- Admin Actions ---

export async function removeMember(app, userId) {
    if (!confirm('Are you sure you want to remove this member?')) return;
    try {
        const res = await fetch(`/api/rooms/${app.currentRoom}/members/${userId}/remove`, {
            method: 'PUT',
            headers: { 'Authorization': 'Bearer ' + app.token }
        });
        if (res.ok) {
            showToast('Member removed', 'success');
            loadRoomMembers(app, app.currentRoom);
        } else {
            const err = await res.json();
            showToast(err.error || 'Failed to remove member', 'error');
        }
    } catch (e) {
        console.error(e);
        showToast('Network error', 'error');
    }
}

export async function toggleMemberMute(app, userId) {
    try {
        const res = await fetch(`/api/rooms/${app.currentRoom}/members/${userId}/mute`, {
            method: 'PUT',
            headers: { 'Authorization': 'Bearer ' + app.token }
        });
        if (res.ok) {
            showToast('Member mute status toggled', 'success');
            loadRoomMembers(app, app.currentRoom);
        } else {
            const err = await res.json();
            showToast(err.error || 'Failed to toggle mute', 'error');
        }
    } catch (e) {
        console.error(e);
        showToast('Network error', 'error');
    }
}

export async function toggleAdminRole(app, userId) {
    if (!confirm('Toggle admin role for this member?')) return;
    try {
        const res = await fetch(`/api/rooms/${app.currentRoom}/members/${userId}/admin`, {
            method: 'PUT',
            headers: { 'Authorization': 'Bearer ' + app.token }
        });
        if (res.ok) {
            showToast('Admin role toggled', 'success');
            loadRoomMembers(app, app.currentRoom);
        } else {
            const err = await res.json();
            showToast(err.error || 'Failed to toggle admin role', 'error');
        }
    } catch (e) {
        console.error(e);
        showToast('Network error', 'error');
    }
}

export async function toggleRoomMute(app) {
    try {
        const res = await fetch(`/api/rooms/${app.currentRoom}/mute`, {
            method: 'PUT',
            headers: { 'Authorization': 'Bearer ' + app.token }
        });
        if (res.ok) {
            showToast('Room mute toggled', 'success');
            loadRoomMembers(app, app.currentRoom);
        } else {
            const err = await res.json();
            showToast(err.error || 'Failed to toggle room mute', 'error');
            const toggle = document.getElementById('mute-room-toggle');
            if (toggle) toggle.checked = !toggle.checked;
        }
    } catch (e) {
        console.error(e);
        showToast('Network error', 'error');
        const toggle = document.getElementById('mute-room-toggle');
        if (toggle) toggle.checked = !toggle.checked;
    }
}
