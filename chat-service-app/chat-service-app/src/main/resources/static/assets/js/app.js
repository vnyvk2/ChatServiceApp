/**
 * ChatApp - Main Orchestrator
 * 
 * This is the entry point for the chat application. It imports functionality
 * from individual modules and wires everything together.
 * 
 * Module structure:
 *   auth.js      - Login, register, logout
 *   websocket.js - STOMP/WebSocket connection & subscriptions
 *   rooms.js     - Room CRUD, selection, sidebar rendering
 *   messages.js  - Message sending, loading, display, typing
 *   members.js   - Member list, admin controls (mute/remove/promote)
 *   ui.js        - Toasts, modals, layout helpers, escapeHtml
 */

import { login, register, logout, showLogin, showRegister } from './auth.js?v=12';
import { connectWebSocket, updateUserStatus } from './websocket.js?v=12';
import { loadMyRooms, loadAvailableRooms, selectRoom, createRoom, joinRoom, leaveRoom, startDirectMessage, renameRoom, deleteRoom, clearChat } from './rooms.js?v=12';
import { loadMessages, displayMessage, displayEvent, displayTyping, sendMessage, handleTyping, sendDeliveryAck, sendSeenAck, updateMessageStatuses, promptEditMessage, promptDeleteMessage } from './messages.js?v=12';
import { loadRoomMembers, removeMember, toggleMemberMute, toggleAdminRole, toggleRoomMute } from './members.js?v=12';
import { showToast, closeModals, showModal, adjustLayout, escapeHtml } from './ui.js?v=12';

class ChatApp {
    constructor() {
        this.stompClient = null;
        this.currentUser = null;
        this.currentRoom = null;
        this.currentRoomType = null;
        this.currentRoomOtherMember = null;
        this.token = null;
        this.typingTimer = null;
        this.isTyping = false;
        this.roomSubscriptions = [];
        this.readReceiptsEnabled = true;
        this.showOnlineStatus = true;
        this.lastSeenVisible = true;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkExistingSession();
    }

    setupEventListeners() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeModals();
        });

        window.addEventListener('resize', () => adjustLayout());

        document.addEventListener('visibilitychange', () => {
            if (this.currentUser) {
                const status = document.hidden ? 'AWAY' : 'ONLINE';
                updateUserStatus(this, status);
            }
        });

        // Profile logic
        document.getElementById('profile-btn')?.addEventListener('click', () => this.showProfile());
        document.getElementById('save-profile-btn')?.addEventListener('click', () => this.saveProfile());

        document.querySelectorAll('.cancel-modal-btn').forEach(btn => {
            btn.addEventListener('click', () => closeModals());
        });
    }

    checkExistingSession() {
        const savedToken = localStorage.getItem('chatToken');
        const savedUser = localStorage.getItem('chatUser');

        if (savedToken && savedUser) {
            this.token = savedToken;
            this.currentUser = JSON.parse(savedUser);
            this.showChatSection();
        }
    }

    // --- Auth (delegates to auth.js) ---
    login() { return login(this); }
    register() { return register(this); }
    logout() { return logout(this); }
    showLogin() { showLogin(); }
    showRegister() { showRegister(); }

    // --- Chat Section ---
    showChatSection() {
        const authSection = document.getElementById('auth-section');
        const chatSection = document.getElementById('chat-section');

        if (authSection) authSection.style.display = 'none';
        if (chatSection) chatSection.style.display = 'flex';

        document.getElementById('current-user').textContent = this.currentUser.displayName || this.currentUser.username;
        try {
            document.getElementById('status-select').value = (this.currentUser.status || 'ONLINE');
        } catch (e) { /* ignore */ }

        connectWebSocket(this);
        this.loadMyRooms();
        this.loadAvailableRooms();
        this.fetchReadReceiptSetting();
        this.fetchOnlineStatusSetting();
        this.fetchLastSeenSetting();
    }

    // --- Rooms (delegates to rooms.js) ---
    loadMyRooms() { return loadMyRooms(this); }
    loadAvailableRooms() { return loadAvailableRooms(this); }
    selectRoom(roomId, roomName, roomType, e) { return selectRoom(this, roomId, roomName, roomType, e); }
    createRoom() { return createRoom(this); }
    joinRoom(roomId) { return joinRoom(this, roomId); }
    leaveRoom(roomId) { return leaveRoom(this, roomId); }
    startDirectMessage() { return startDirectMessage(this); }
    renameRoom() { return renameRoom(this); }
    deleteRoom(roomId) { return deleteRoom(this, roomId); }
    clearChat(roomId) { return clearChat(this, roomId); }

    // --- Messages (delegates to messages.js) ---
    loadMessages(roomId) { return loadMessages(this, roomId); }
    displayMessage(data, animate) { return displayMessage(this, data, animate); }
    displayEvent(event) { return displayEvent(this, event); }
    displayTyping(typing) { return displayTyping(this, typing); }
    sendMessage() { return sendMessage(this); }
    handleTyping(isTyping) { return handleTyping(this, isTyping); }
    sendDeliveryAck(roomId) { return sendDeliveryAck(this, roomId); }
    sendSeenAck(roomId) { return sendSeenAck(this, roomId); }
    updateMessageStatuses(msgIds, status) { return updateMessageStatuses(msgIds, status); }
    promptEditMessage(messageId) { return promptEditMessage(this, messageId); }
    promptDeleteMessage(messageId) { return promptDeleteMessage(this, messageId); }

    // --- Members (delegates to members.js) ---
    loadRoomMembers(roomId) { return loadRoomMembers(this, roomId); }
    removeMember(userId) { return removeMember(this, userId); }
    toggleMemberMute(userId) { return toggleMemberMute(this, userId); }
    toggleAdminRole(userId) { return toggleAdminRole(this, userId); }
    toggleRoomMute() { return toggleRoomMute(this); }

    // --- UI (delegates to ui.js) ---
    showToast(msg, type, dur) { return showToast(msg, type, dur); }
    closeModals() { return closeModals(); }
    escapeHtml(text) { return escapeHtml(text); }

    // --- Status ---
    updateStatus() {
        const newStatus = document.getElementById('status-select').value.toUpperCase();
        updateUserStatus(this, newStatus);
        // Update the profile dot color
        this._updateProfileStatusDot(newStatus);
    }

    _updateProfileStatusDot(status) {
        const dot = document.getElementById('profile-status-dot');
        if (!dot) return;
        switch (status) {
            case 'ONLINE': dot.style.background = '#22c55e'; break;
            case 'AWAY': dot.style.background = '#eab308'; break;
            case 'OFFLINE': dot.style.background = '#9ca3af'; break;
            default: dot.style.background = '#22c55e';
        }
    }

    // --- Modals ---
    showCreateRoom() { showModal('create-room-modal'); }
    showJoinRoom() { this.loadAvailableRooms(); showModal('join-room-modal'); }
    showDirectMessage() { showModal('direct-message-modal'); }

    showRenameRoom() {
        if (!this.currentRoom) return;
        const currentName = document.getElementById('current-room-name').textContent;
        document.getElementById('rename-room-input').value = currentName;
        showModal('rename-room-modal');
    }

    // --- Profile ---
    showProfile() {
        document.getElementById('profile-username').value = this.currentUser.username || '';
        document.getElementById('profile-phone').value = this.currentUser.phoneNumber || '';
        document.getElementById('profile-email').value = this.currentUser.email || '';
        const readReceiptsToggle = document.getElementById('read-receipts-toggle');
        if (readReceiptsToggle) {
            readReceiptsToggle.checked = this.readReceiptsEnabled;
        }
        const onlineStatusToggle = document.getElementById('online-status-toggle');
        if (onlineStatusToggle) {
            onlineStatusToggle.checked = this.showOnlineStatus;
        }
        const lastSeenToggle = document.getElementById('last-seen-toggle');
        if (lastSeenToggle) {
            lastSeenToggle.checked = this.lastSeenVisible;
        }
        // Set status dropdown to current status
        const statusSelect = document.getElementById('status-select');
        if (statusSelect) {
            statusSelect.value = (this.currentUser.status || 'ONLINE');
        }
        // Update profile dot color
        this._updateProfileStatusDot(this.currentUser.status || 'ONLINE');
        showModal('profile-modal');
    }

    async fetchReadReceiptSetting() {
        try {
            const response = await fetch('/api/users/read-receipts', {
                headers: { 'Authorization': 'Bearer ' + this.token }
            });
            if (response.ok) {
                const data = await response.json();
                this.readReceiptsEnabled = data.readReceiptsEnabled;
            }
        } catch (e) {
            console.error('Error fetching read receipt setting:', e);
        }
    }

    async toggleReadReceipts() {
        const toggle = document.getElementById('read-receipts-toggle');
        const enabled = toggle ? toggle.checked : true;
        try {
            const response = await fetch('/api/users/read-receipts', {
                method: 'PUT',
                headers: {
                    'Authorization': 'Bearer ' + this.token,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ readReceiptsEnabled: enabled })
            });
            if (response.ok) {
                const data = await response.json();
                this.readReceiptsEnabled = data.readReceiptsEnabled;
                showToast(enabled ? 'Read receipts enabled' : 'Read receipts disabled', 'success');
            } else {
                showToast('Failed to update setting', 'error');
                if (toggle) toggle.checked = !enabled;
            }
        } catch (e) {
            console.error('Error toggling read receipts:', e);
            showToast('Network error', 'error');
            if (toggle) toggle.checked = !enabled;
        }
    }

    async fetchOnlineStatusSetting() {
        try {
            const response = await fetch('/api/users/online-status', {
                headers: { 'Authorization': 'Bearer ' + this.token }
            });
            if (response.ok) {
                const data = await response.json();
                this.showOnlineStatus = data.showOnlineStatus;
            }
        } catch (e) {
            console.error('Error fetching online status setting:', e);
        }
    }

    async toggleOnlineStatus() {
        const toggle = document.getElementById('online-status-toggle');
        const enabled = toggle ? toggle.checked : true;
        try {
            const response = await fetch('/api/users/online-status', {
                method: 'PUT',
                headers: {
                    'Authorization': 'Bearer ' + this.token,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ showOnlineStatus: enabled })
            });
            if (response.ok) {
                const data = await response.json();
                this.showOnlineStatus = data.showOnlineStatus;
                showToast(enabled ? 'Online status visible' : 'Online status hidden', 'success');
            } else {
                showToast('Failed to update setting', 'error');
                if (toggle) toggle.checked = !enabled;
            }
        } catch (e) {
            console.error('Error toggling online status:', e);
            showToast('Network error', 'error');
            if (toggle) toggle.checked = !enabled;
        }
    }

    async fetchLastSeenSetting() {
        try {
            const response = await fetch('/api/users/last-seen-visibility', {
                headers: { 'Authorization': 'Bearer ' + this.token }
            });
            if (response.ok) {
                const data = await response.json();
                this.lastSeenVisible = data.lastSeenVisible;
            }
        } catch (e) {
            console.error('Error fetching last seen setting:', e);
        }
    }

    async toggleLastSeen() {
        const toggle = document.getElementById('last-seen-toggle');
        const enabled = toggle ? toggle.checked : true;
        try {
            const response = await fetch('/api/users/last-seen-visibility', {
                method: 'PUT',
                headers: {
                    'Authorization': 'Bearer ' + this.token,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ lastSeenVisible: enabled })
            });
            if (response.ok) {
                const data = await response.json();
                this.lastSeenVisible = data.lastSeenVisible;
                if (enabled) {
                    showToast('Last seen visible', 'success');
                } else {
                    showToast('Last seen hidden (you also cannot see others\' last seen)', 'info');
                }
            } else {
                showToast('Failed to update setting', 'error');
                if (toggle) toggle.checked = !enabled;
            }
        } catch (e) {
            console.error('Error toggling last seen:', e);
            showToast('Network error', 'error');
            if (toggle) toggle.checked = !enabled;
        }
    }

    async saveProfile() {
        const username = document.getElementById('profile-username').value.trim();
        const phoneNumber = document.getElementById('profile-phone').value.trim();
        const email = document.getElementById('profile-email').value.trim();

        try {
            const response = await fetch('/api/users/profile', {
                method: 'PUT',
                headers: {
                    'Authorization': 'Bearer ' + this.token,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, phoneNumber, email })
            });

            if (response.ok) {
                const updatedUser = await response.json();
                this.currentUser = { ...this.currentUser, ...updatedUser };
                localStorage.setItem('chatUser', JSON.stringify(this.currentUser));
                document.getElementById('current-user').textContent = this.currentUser.displayName || this.currentUser.username;
                showToast('Profile updated successfully', 'success');
                closeModals();
            } else {
                const error = await response.json();
                showToast(error.error || 'Failed to update profile', 'error');
            }
        } catch (error) {
            console.error('Error updating profile:', error);
            showToast('Network error', 'error');
        }
    }

    // --- User Details Modal (for DM info) ---
    _showUserDetailsModal(member) {
        console.log('[DEBUG] _showUserDetailsModal called with:', member);

        let overlay = document.getElementById('modal-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'modal-overlay';
            overlay.className = 'hidden';
            overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);backdrop-filter:blur(2px);display:flex;align-items:center;justify-content:center;z-index:9999;';
            overlay.addEventListener('click', (e) => { if (e.target === e.currentTarget) closeModals(); });
            document.body.appendChild(overlay);
        }

        let modal = document.getElementById('user-details-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'user-details-modal';
            modal.className = 'modal hidden';
            modal.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:white;padding:2rem;border-radius:12px;width:90%;max-width:420px;box-shadow:0 10px 15px -3px rgba(0,0,0,0.1);z-index:10000;';
            document.body.appendChild(modal);
        }

        // Determine status dot color
        const statusColor = member.status === 'ONLINE' ? '#22c55e' : (member.status === 'AWAY' ? '#eab308' : '#9ca3af');
        const statusText = member.status ? member.status.charAt(0) + member.status.slice(1).toLowerCase() : 'Offline';

        modal.innerHTML = `
            <div style="text-align:center;margin-bottom:1rem;position:relative;display:inline-block;width:100%;">
                <i class="fas fa-user-circle" style="font-size:3rem;color:#3b82f6;"></i>
                <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${statusColor};border:2px solid white;position:relative;top:-5px;left:-5px;"></span>
            </div>
            <h3 id="ud-display-name" style="text-align:center;margin-bottom:0.25rem;">${escapeHtml(member.displayName || 'Unknown')}</h3>
            <div style="text-align:center;font-size:0.8rem;color:#64748b;margin-bottom:1.5rem;">${statusText}</div>
            <div style="margin-bottom:1rem;">
                <label style="font-size:0.85rem;color:#64748b;">Username</label>
                <div id="ud-username" style="padding:0.75rem;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;margin-top:0.25rem;">${escapeHtml(member.username || 'N/A')}</div>
            </div>
            <div style="margin-bottom:1rem;">
                <label style="font-size:0.85rem;color:#64748b;">Phone Number</label>
                <div id="ud-phone" style="padding:0.75rem;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;margin-top:0.25rem;">${escapeHtml(member.phoneNumber || 'N/A')}</div>
            </div>
            <div style="display:flex;gap:0.5rem;margin-top:1.5rem;">
                <button id="modal-rename-btn" style="flex:1;padding:0.75rem;border-radius:8px;font-weight:500;cursor:pointer;background:#3b82f6;color:white;border:none;">Rename Chat</button>
                <button id="modal-delete-room-btn" style="flex:1;padding:0.75rem;border-radius:8px;font-weight:500;cursor:pointer;background:#fef2f2;color:#ef4444;border:1px solid #fca5a5;"><i class="fas fa-trash"></i> Delete</button>
                <button id="modal-close-btn" style="flex:1;padding:0.75rem;border-radius:8px;font-weight:500;cursor:pointer;background:transparent;border:1px solid #e2e8f0;color:#64748b;">Close</button>
            </div>
        `;

        modal.querySelector('#modal-close-btn').addEventListener('click', () => closeModals());
        modal.querySelector('#modal-rename-btn').addEventListener('click', () => {
            closeModals();
            this.showRenameRoom();
        });
        modal.querySelector('#modal-delete-room-btn').addEventListener('click', () => {
            closeModals();
            this.deleteRoom(this.currentRoom);
        });

        overlay.classList.remove('hidden');
        modal.classList.remove('hidden');
    }

} // End of ChatApp class

// --- Initialize and bind event listeners ---
document.addEventListener('DOMContentLoaded', () => {
    window.chatApp = new ChatApp();

    // Auth Form Listeners
    document.getElementById('login-btn')?.addEventListener('click', () => chatApp.login());
    document.getElementById('register-btn')?.addEventListener('click', () => chatApp.register());
    document.getElementById('show-register-btn')?.addEventListener('click', () => chatApp.showRegister());
    document.getElementById('show-login-btn')?.addEventListener('click', () => chatApp.showLogin());

    // Main Chat View Button Listeners
    document.getElementById('show-create-room-btn')?.addEventListener('click', () => chatApp.showCreateRoom());
    document.getElementById('show-join-room-btn')?.addEventListener('click', () => chatApp.showJoinRoom());
    document.getElementById('show-dm-btn')?.addEventListener('click', () => chatApp.showDirectMessage());

    // Members Panel Toggle & Room Header Button - wired in rooms.js selectRoom()

    // Rename Room Submit (confirm button in modal)
    document.getElementById('confirm-rename-btn')?.addEventListener('click', () => chatApp.renameRoom());

    // Rename Button in Modal (modal-rename-btn = "Rename Chat" button in user-details-modal)
    document.getElementById('modal-rename-btn')?.addEventListener('click', () => {
        chatApp.closeModals();
        chatApp.showRenameRoom();
    });

    // Status Dropdown
    document.getElementById('status-select')?.addEventListener('change', () => chatApp.updateStatus());

    // Modal Actions
    document.getElementById('create-room-btn')?.addEventListener('click', () => chatApp.createRoom());
    document.getElementById('start-dm-btn')?.addEventListener('click', () => chatApp.startDirectMessage());

    // Logout
    document.getElementById('logout-btn')?.addEventListener('click', () => chatApp.logout());

    // Modal Cancel Buttons
    document.querySelectorAll('.cancel-modal-btn').forEach(btn => {
        btn.addEventListener('click', () => chatApp.closeModals());
    });

    document.getElementById('modal-overlay')?.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) chatApp.closeModals();
    });

    // Message Sending
    const messageInput = document.getElementById('message-input');
    document.getElementById('send-btn')?.addEventListener('click', () => chatApp.sendMessage());
    messageInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            chatApp.sendMessage();
        }
    });
    messageInput?.addEventListener('keyup', () => chatApp.handleTyping());

    // Read Receipts Toggle
    document.getElementById('read-receipts-toggle')?.addEventListener('change', () => chatApp.toggleReadReceipts());

    // Online Status Toggle
    document.getElementById('online-status-toggle')?.addEventListener('change', () => chatApp.toggleOnlineStatus());

    // Last Seen Toggle
    document.getElementById('last-seen-toggle')?.addEventListener('change', () => chatApp.toggleLastSeen());

    console.log("app.js loaded and ChatApp initialized with ES6 modules ✅");
});