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

import { login, register, logout, showLogin, showRegister } from './auth.js?v=10';
import { connectWebSocket, updateUserStatus } from './websocket.js?v=10';
import { loadMyRooms, loadAvailableRooms, selectRoom, createRoom, joinRoom, leaveRoom, startDirectMessage, renameRoom } from './rooms.js?v=10';
import { loadMessages, displayMessage, displayEvent, displayTyping, sendMessage, handleTyping } from './messages.js?v=10';
import { loadRoomMembers, removeMember, toggleMemberMute, toggleAdminRole, toggleRoomMute } from './members.js?v=10';
import { showToast, closeModals, showModal, adjustLayout, escapeHtml } from './ui.js?v=10';

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

    // --- Messages (delegates to messages.js) ---
    loadMessages(roomId) { return loadMessages(this, roomId); }
    displayMessage(data, animate) { return displayMessage(this, data, animate); }
    displayEvent(event) { return displayEvent(this, event); }
    displayTyping(typing) { return displayTyping(this, typing); }
    sendMessage() { return sendMessage(this); }
    handleTyping(isTyping) { return handleTyping(this, isTyping); }

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
        showModal('profile-modal');
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
            modal.innerHTML = `
                <div style="text-align:center;margin-bottom:1rem;">
                    <i class="fas fa-user-circle" style="font-size:3rem;color:#3b82f6;"></i>
                </div>
                <h3 id="ud-display-name" style="text-align:center;margin-bottom:1.5rem;">User Name</h3>
                <div style="margin-bottom:1rem;">
                    <label style="font-size:0.85rem;color:#64748b;">Username</label>
                    <div id="ud-username" style="padding:0.75rem;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;margin-top:0.25rem;"></div>
                </div>
                <div style="margin-bottom:1rem;">
                    <label style="font-size:0.85rem;color:#64748b;">Phone Number</label>
                    <div id="ud-phone" style="padding:0.75rem;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;margin-top:0.25rem;"></div>
                </div>
                <div style="display:flex;gap:0.5rem;margin-top:1.5rem;">
                    <button id="modal-rename-btn" style="flex:1;padding:0.75rem;border-radius:8px;font-weight:500;cursor:pointer;background:#3b82f6;color:white;border:none;">Rename Chat</button>
                    <button id="modal-close-btn" style="flex:1;padding:0.75rem;border-radius:8px;font-weight:500;cursor:pointer;background:transparent;border:1px solid #e2e8f0;color:#64748b;">Close</button>
                </div>
            `;
            document.body.appendChild(modal);

            modal.querySelector('#modal-close-btn').addEventListener('click', () => closeModals());
            modal.querySelector('#modal-rename-btn').addEventListener('click', () => {
                closeModals();
                this.showRenameRoom();
            });
        }

        document.getElementById('ud-display-name').textContent = member.displayName || 'Unknown';
        document.getElementById('ud-username').textContent = member.username || 'N/A';
        document.getElementById('ud-phone').textContent = member.phoneNumber || 'N/A';
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

    console.log("app.js loaded and ChatApp initialized with ES6 modules ✅");
});