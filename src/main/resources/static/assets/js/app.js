// app.js -- single-file ChatApp (only the changed/important parts shown + full init at bottom)
// Keep your existing ChatApp methods (connectWebSocket, sendMessage, etc.)
// This file fixes init/binding and small DOM id mismatches.

class ChatApp {
    constructor() {
        this.stompClient = null;
        this.currentUser = null;
        this.currentRoom = null;
        this.token = null;
        this.typingTimer = null;
        this.isTyping = false;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkExistingSession();
    }

    setupEventListeners() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModals();
            }
        });

        window.addEventListener('resize', () => {
            this.adjustLayout();
        });

        document.addEventListener('visibilitychange', () => {
            if (this.currentUser) {
                const status = document.hidden ? 'AWAY' : 'ONLINE';
                this.updateUserStatus(status);
            }
        });

        // Message input enter handler (example: connect to DOM if present)
        document.addEventListener('keydown', (e) => {
            const active = document.activeElement;
            if (active && active.id === 'message-input' && e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
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

    // ------------- Authentication -------------
    async login() {
        const username = document.getElementById('login-username')?.value.trim();
        const password = document.getElementById('login-password')?.value;

        if (!username || !password) {
            this.showToast('Please fill in all fields', 'error');
            return;
        }

        this.setButtonLoading('login', true);

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (response.ok && data.token) {
                this.token = data.token;
                // backend returns data.user as a map (see your AuthController)
                this.currentUser = data.user || {
                    username: data.username,
                    displayName: data.displayName,
                    status: data.status || 'ONLINE'
                };

                localStorage.setItem('chatToken', this.token);
                localStorage.setItem('chatUser', JSON.stringify(this.currentUser));

                this.showChatSection();
                this.showToast('Login successful!', 'success');
            } else {
                this.showToast(data.error || 'Login failed', 'error');
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showToast('Network error. Please try again.', 'error');
        } finally {
            this.setButtonLoading('login', false);
        }
    }

    async register() {
        // NOTE: these IDs match your provided HTML (register-username, register-email, etc.)
        const username = document.getElementById('register-username')?.value.trim();
        const email = document.getElementById('register-email')?.value.trim();
        const phoneNumber = document.getElementById('register-phone')?.value.trim();
        const displayName = document.getElementById('register-displayname')?.value.trim();
        const password = document.getElementById('register-password')?.value;

        if (!username || !email || !displayName || !password) {
            this.showToast('Please fill in all required fields', 'error');
            return;
        }

        if (password.length < 6) {
            this.showToast('Password must be at least 6 characters', 'error');
            return;
        }

        this.setButtonLoading('register', true);

        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username,
                    email,
                    phoneNumber: phoneNumber || null,
                    displayName,
                    password
                })
            });

            const data = await response.json();

            if (response.ok && data.token) {
                this.token = data.token;
                this.currentUser = data.user || {
                    username: data.username,
                    displayName: data.displayName,
                    status: data.status || 'OFFLINE'
                };

                localStorage.setItem('chatToken', this.token);
                localStorage.setItem('chatUser', JSON.stringify(this.currentUser));

                this.showChatSection();
                this.showToast('Registration successful!', 'success');
            } else {
                this.showToast(data.error || 'Registration failed', 'error');
            }
        } catch (error) {
            console.error('Registration error:', error);
            this.showToast('Network error. Please try again.', 'error');
        } finally {
            this.setButtonLoading('register', false);
        }
    }

    async logout() {
        if (this.stompClient && this.stompClient.connected) {
            try { this.stompClient.disconnect(); } catch (e) { /* ignore */ }
        }

        try {
            await fetch('/api/auth/logout', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + this.token,
                    'Content-Type': 'application/json'
                }
            });
        } catch (error) {
            console.error('Logout error:', error);
        }

        localStorage.removeItem('chatToken');
        localStorage.removeItem('chatUser');

        this.token = null;
        this.currentUser = null;
        this.currentRoom = null;

        // show auth section (your HTML uses display; so use style)
        document.getElementById('chat-section').style.display = 'none';
        document.getElementById('auth-section').style.display = 'block';
        this.showLogin();

        this.showToast('Logged out successfully', 'success');
    }

    // ------------- UI helpers -------------
    showLogin() {
        const loginForm = document.getElementById('login-form');
        const registerForm = document.getElementById('register-form');
        if (loginForm) loginForm.style.display = 'block';
        if (registerForm) registerForm.style.display = 'none';
    }

    showRegister() {
        const loginForm = document.getElementById('login-form');
        const registerForm = document.getElementById('register-form');
        if (loginForm) loginForm.style.display = 'none';
        if (registerForm) registerForm.style.display = 'block';
    }

    showChatSection() {
        const authSection = document.getElementById('auth-section');
        const chatSection = document.getElementById('chat-section');

        if (authSection) authSection.style.display = 'none';
        if (chatSection) chatSection.style.display = 'block';

        document.getElementById('current-user').textContent = this.currentUser.displayName || this.currentUser.username;
        // map statuses to select values if present
        try {
            document.getElementById('status-select').value = (this.currentUser.status || 'ONLINE').toLowerCase();
        } catch (e) { /* ignore */ }

        this.connectWebSocket();
        this.loadMyRooms();
        this.loadAvailableRooms();
    }

    setButtonLoading(buttonType, isLoading) {
        const button = Array.from(document.querySelectorAll('button')).find(b => {
            const attr = b.getAttribute('onclick') || '';
            return attr.includes(buttonType + '()');
        });
        if (!button) return;
        button.disabled = isLoading;
        if (isLoading) button.classList.add('loading'); else button.classList.remove('loading');
    }

    // ... keep the rest of your ChatApp methods unchanged (connectWebSocket, subscribeToRoom, sendMessage, etc.)
    // minor shim to match bindings
    async startDirectMessage() {
        return this.createDirectMessage ? this.createDirectMessage() : null;
    }

    // show/hide modal helpers using style.display
    showCreateRoom() {
        document.getElementById('modal-overlay').style.display = 'block';
        document.getElementById('create-room-modal').style.display = 'block';
    }
    showJoinRoom() {
        this.loadAvailableRooms();
        document.getElementById('modal-overlay').style.display = 'block';
        document.getElementById('join-room-modal').style.display = 'block';
    }
    showDirectMessage() {
        document.getElementById('modal-overlay').style.display = 'block';
        document.getElementById('direct-message-modal').style.display = 'block';
    }
    hideModals() {
        document.getElementById('modal-overlay').style.display = 'none';
        document.getElementById('create-room-modal').style.display = 'none';
        document.getElementById('join-room-modal').style.display = 'none';
        document.getElementById('direct-message-modal').style.display = 'none';
    }

    showToast(message, type = 'info', duration = 5000) {
        const toastContainer = document.getElementById('toast-container');
        if (!toastContainer) return;
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const icons = {
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-circle',
            warning: 'fas fa-exclamation-triangle',
            info: 'fas fa-info-circle'
        };

        toast.innerHTML = `
            <div class="toast-icon">
                <i class="${icons[type] || icons.info}"></i>
            </div>
            <div class="toast-content">
                <div class="toast-message">${this.escapeHtml(message)}</div>
            </div>
            <button class="toast-close" onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        `;

        toastContainer.appendChild(toast);

        setTimeout(() => {
            if (toast.parentElement) {
                toast.style.animation = 'fadeOut 0.3s ease forwards';
                setTimeout(() => toast.remove(), 300);
            }
        }, duration);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize app once and bind global functions for onclick HTML usage
document.addEventListener('DOMContentLoaded', () => {
    window.chatApp = new ChatApp();

    window.login = () => chatApp.login();
    window.register = () => chatApp.register();
    window.showLogin = () => chatApp.showLogin();
    window.showRegister = () => chatApp.showRegister();
    window.showCreateRoom = () => chatApp.showCreateRoom();
    window.showJoinRoom = () => chatApp.showJoinRoom();
    window.showDirectMessage = () => chatApp.showDirectMessage();
    window.createRoom = () => chatApp.createRoom && chatApp.createRoom();
    window.startDirectMessage = () => chatApp.startDirectMessage();
    window.hideModals = () => chatApp.hideModals();

    console.log("app.js loaded and ChatApp initialized ✅");
});
