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

        // Profile logic
        document.getElementById('profile-btn')?.addEventListener('click', () => this.showProfile());
        document.getElementById('save-profile-btn')?.addEventListener('click', () => this.saveProfile());

        // Rename logic
        document.getElementById('rename-room-btn')?.addEventListener('click', () => this.showRenameRoom());
        document.getElementById('confirm-rename-btn')?.addEventListener('click', () => this.renameRoom());

        // Cancel buttons for new modals
        document.querySelectorAll('.cancel-modal-btn').forEach(btn => {
            btn.addEventListener('click', () => this.closeModals());
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
        if (chatSection) chatSection.style.display = 'flex'; // Use flex to maintain row layout

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
        // ✅ Expect buttons to have ids like login-btn, register-btn
        const button = document.getElementById(`${buttonType}-btn`);
        if (!button) return;

        button.disabled = isLoading;
        if (isLoading) {
            button.dataset.originalText = button.textContent;
            button.textContent = 'Loading...';
        } else {
            button.textContent = button.dataset.originalText || button.textContent;
        }
    }


    // ... keep the rest of your ChatApp methods unchanged (connectWebSocket, subscribeToRoom, sendMessage, etc.)
    // minor shim to match bindings
    // WebSocket Methods
    connectWebSocket() {
        const socket = new SockJS('/ws');
        this.stompClient = Stomp.over(socket);

        this.stompClient.connect(
            { 'Authorization': 'Bearer ' + this.token },
            (frame) => {
                console.log('Connected: ' + frame);
                this.onWebSocketConnected();
            },
            (error) => {
                console.error('WebSocket connection error:', error);
                this.showToast('Connection failed. Retrying...', 'error');
                setTimeout(() => this.connectWebSocket(), 5000);
            }
        );
    }

    onWebSocketConnected() {
        // Subscribe to user-specific channels
        this.stompClient.subscribe('/user/topic/user-status/' + this.currentUser.username, (message) => {
            const statusUpdate = JSON.parse(message.body);
            console.log('Status update:', statusUpdate);
        });

        // Subscribe to error messages
        this.stompClient.subscribe('/user/queue/errors', (message) => {
            const error = JSON.parse(message.body);
            console.error('WebSocket error:', error);
            this.showToast('Error: ' + error.message, 'error');
        });

        this.showToast('Connected successfully!', 'success');
    }

    // Room Management Methods
    async loadMyRooms() {
        try {
            const response = await fetch('/api/rooms/my-rooms', {
                headers: { 'Authorization': 'Bearer ' + this.token }
            });

            if (response.ok) {
                const rooms = await response.json();
                this.displayMyRooms(rooms);
            }
        } catch (error) {
            console.error('Error loading rooms:', error);
            this.showToast('Failed to load rooms', 'error');
        }
    }

    async loadAvailableRooms() {
        try {
            const response = await fetch('/api/rooms/available', {
                headers: { 'Authorization': 'Bearer ' + this.token }
            });

            if (response.ok) {
                const rooms = await response.json();
                this.displayAvailableRooms(rooms);
            }
        } catch (error) {
            console.error('Error loading available rooms:', error);
        }
    }

    displayMyRooms(rooms) {
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
            roomElement.onclick = (e) => this.selectRoom(room.id, room.name, room.roomType, e);

            roomElement.innerHTML = `
                        <div class="room-item-header">
                            <div class="room-name">${this.escapeHtml(room.name)}</div>
                            <div class="room-actions-btn">
                                <button class="btn-icon" onclick="event.stopPropagation(); chatApp.leaveRoom(${room.id})" title="Leave Room">
                                    <i class="fas fa-sign-out-alt"></i>
                                </button>
                            </div>
                        </div>
                        <div class="room-type">${room.roomType.replace('_', ' ')}</div>
                        ${room.description ? `<div class="room-description">${this.escapeHtml(room.description)}</div>` : ''}
                    `;

            roomList.appendChild(roomElement);
        });
    }

    displayAvailableRooms(rooms) {
        const availableRooms = document.getElementById('available-rooms');
        availableRooms.innerHTML = '';

        if (rooms.length === 0) {
            availableRooms.innerHTML = '<div class="no-rooms">No public rooms available</div>';
            return;
        }

        rooms.forEach(room => {
            const roomElement = document.createElement('div');
            roomElement.className = 'available-room-item';
            roomElement.onclick = (e) => { e.stopPropagation && e.stopPropagation(); this.joinRoom(room.id); };

            roomElement.innerHTML = `
                        <div class="room-item-name">${this.escapeHtml(room.name)}</div>
                        ${room.description ? `<div class="room-item-desc">${this.escapeHtml(room.description)}</div>` : ''}
                        <div class="room-item-meta">
                            <span>${room.roomType.replace('_', ' ')}</span>
                            <button class="btn-primary btn-small" onclick="event.stopPropagation(); chatApp.joinRoom(${room.id})">
                                Join Room
                            </button>
                        </div>
                    `;

            availableRooms.appendChild(roomElement);
        });
    }

    async selectRoom(roomId, roomName, roomType, e = null) {
        // Unsubscribe from previous room if any
        if (this.currentRoom) {
            this.unsubscribeFromRoom(this.currentRoom);
        }

        this.currentRoom = roomId;
        const currentRoomNameEl = document.getElementById('current-room-name');
        if (currentRoomNameEl) currentRoomNameEl.textContent = roomName;

        // Show rename button
        const renameBtn = document.getElementById('rename-room-btn');
        if (renameBtn) renameBtn.classList.remove('hidden');

        document.getElementById('chat-input-area').classList.remove('hidden');

        // Update active room styling
        document.querySelectorAll('.room-item').forEach(item => item.classList.remove('active'));
        // if event element exists, mark its closest .room-item as active
        try {
            const roomItemEl = e && (e.currentTarget || e.target) ? (e.currentTarget || e.target).closest('.room-item') : null;
            if (roomItemEl) {
                roomItemEl.classList.add('active');
            } else {
                // fallback: find element by data attribute if you set one
                // document.querySelector(`.room-item[data-room-id="${roomId}"]`)?.classList.add('active');
            }
        } catch (err) {
            // non-fatal
            console.warn('Could not set active class for room item', err);
        }

        // Subscribe to room channels
        if (this.stompClient && this.stompClient.connected) {
            this.subscribeToRoom(roomId);
        }

        // Load room data
        await Promise.all([
            this.loadRoomMembers(roomId),
            this.loadMessages(roomId)
        ]);

        // Clear welcome message
        const welcomeMessage = document.querySelector('.welcome-message');
        if (welcomeMessage) {
            welcomeMessage.style.display = 'none';
        }
    }

    subscribeToRoom(roomId) {
        // Subscribe to room messages
        this.stompClient.subscribe('/topic/rooms/' + roomId, (message) => {
            const messageData = JSON.parse(message.body);
            this.displayMessage(messageData);
        });

        // Subscribe to room events
        this.stompClient.subscribe('/topic/rooms/' + roomId + '/events', (message) => {
            const event = JSON.parse(message.body);
            this.displayEvent(event);
        });

        // Subscribe to typing indicators
        this.stompClient.subscribe('/topic/rooms/' + roomId + '/typing', (message) => {
            const typing = JSON.parse(message.body);
            this.displayTyping(typing);
        });

        // Send join notification
        this.stompClient.send('/app/rooms/' + roomId + '/join-notification', {}, JSON.stringify({}));
    }

    unsubscribeFromRoom(roomId) {
        // Send leave notification
        if (this.stompClient && this.stompClient.connected) {
            this.stompClient.send('/app/rooms/' + roomId + '/leave-notification', {}, JSON.stringify({}));
        }
    }

    async loadRoomMembers(roomId) {
        try {
            const response = await fetch(`/api/rooms/${roomId}/members`, {
                headers: { 'Authorization': 'Bearer ' + this.token }
            });

            if (response.ok) {
                const members = await response.json();
                this.displayRoomMembers(members);
            }
        } catch (error) {
            console.error('Error loading members:', error);
        }
    }

    async loadMessages(roomId) {
        try {
            // Corrected URL to match MessageController
            const response = await fetch(`/api/messages/rooms/${roomId}`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            if (response.ok) {
                const data = await response.json();

                // Handle Page<MessageDto> response
                if (data.content) {
                    // Reverse to show oldest first in chat window
                    this.displayMessages(data.content.reverse());
                } else if (Array.isArray(data)) {
                    this.displayMessages(data);
                }
            } else {
                console.error('Failed to load messages:', response.status);
                this.showToast('Error loading messages', 'error');
            }
        } catch (error) {
            console.error('Error loading messages:', error);
            this.showToast('Error loading messages', 'error');
        }
    }

    displayRoomMembers(members) {
        const onlineUsers = document.getElementById('online-users');
        const membersCount = document.getElementById('room-members-count');

        membersCount.textContent = `${members.length} member${members.length !== 1 ? 's' : ''}`;

        onlineUsers.innerHTML = '';
        members.forEach(member => {
            const memberElement = document.createElement('div');
            memberElement.className = 'member-item';

            const statusClass = 'status-' + member.status.toLowerCase();
            const initials = member.displayName.split(' ').map(n => n[0]).join('').toUpperCase();

            memberElement.innerHTML = `
                        <div class="member-avatar">
                            ${initials}
                            <div class="status-indicator ${statusClass}"></div>
                        </div>
                        <div class="member-info">
                            <div class="member-name">${this.escapeHtml(member.displayName)}</div>
                            <div class="member-status">${member.status.toLowerCase()}</div>
                        </div>
                        <div class="member-role">${member.role.toLowerCase()}</div>
                    `;

            onlineUsers.appendChild(memberElement);
        });
    }

    // Replace the old displayMessages function in app.js with this one.

    displayMessages(messages) {
        const messageArea = document.getElementById('chat-messages');
        messageArea.innerHTML = '';

        // Safety check to ensure we have a valid array to work with
        if (!messages || !Array.isArray(messages)) {
            console.error("displayMessages received invalid data:", messages);
            return;
        }

        messages.forEach(messageData => {
            const messageElement = document.createElement('div');
            const isOwnMessage = messageData.sender.username === this.currentUser.username;
            messageElement.className = `message ${isOwnMessage ? 'own' : ''}`;

            // Ensure createdAt exists before creating a Date from it
            const timestamp = messageData.createdAt ?
                new Date(messageData.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                }) :
                '';

            const senderDisplayName = messageData.sender ? this.escapeHtml(messageData.sender.displayName) : 'Unknown User';
            const messageText = messageData.text ? this.escapeHtml(messageData.text) : '...';

            messageElement.innerHTML = `
                        <div class="message-content">
                            <div class="message-header">
                                <span class="message-sender">${senderDisplayName}</span>
                                <span class="message-time">${timestamp}</span>
                            </div>
                            <div class="message-text">${messageText}</div>
                        </div>
                    `;

            messageArea.appendChild(messageElement);
        });

        this.scrollToBottom();
    }

    displayMessage(messageData, animate = true) {
        const messageArea = document.getElementById('chat-messages');
        const messageElement = document.createElement('div');

        const isOwnMessage = messageData.sender.username === this.currentUser.username;
        messageElement.className = `message ${isOwnMessage ? 'own' : ''}`;

        const timestamp = new Date(messageData.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });

        const initials = messageData.sender.displayName.split(' ').map(n => n[0]).join('').toUpperCase();

        messageElement.innerHTML = `
                    <div class="message-avatar">${initials}</div>
                    <div class="message-content">
                        <div class="message-header">
                            <span class="message-sender">${this.escapeHtml(messageData.sender.displayName)}</span>
                            <span class="message-time">${timestamp}</span>
                            <div class="message-status status-${messageData.sender.status.toLowerCase()}"></div>
                        </div>
                        <div class="message-text">${this.escapeHtml(messageData.text)}</div>
                    </div>
                `;

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

        this.scrollToBottom();
    }

    displayEvent(event) {
        const messageArea = document.getElementById('chat-messages');
        const eventElement = document.createElement('div');
        eventElement.className = 'system-message';

        const timestamp = new Date(event.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });

        eventElement.innerHTML = `${this.escapeHtml(event.message)} <span style="font-size: 0.8em; opacity: 0.7;">${timestamp}</span>`;
        messageArea.appendChild(eventElement);

        this.scrollToBottom();

        // Refresh member list if needed
        if (event.type === 'USER_JOINED' || event.type === 'USER_LEFT') {
            this.loadRoomMembers(this.currentRoom);
        }
    }

    displayTyping(typing) {
        const typingIndicator = document.getElementById('typing-indicator');

        if (typing.isTyping && typing.user.username !== this.currentUser.username) {
            typingIndicator.textContent = `${typing.user.displayName} is typing...`;
            typingIndicator.style.display = 'block';

            // Clear typing indicator after 3 seconds
            setTimeout(() => {
                if (typingIndicator.textContent.includes(typing.user.displayName)) {
                    typingIndicator.textContent = '';
                    typingIndicator.style.display = 'none';
                }
            }, 3000);
        }
    }

    // Message Sending
    sendMessage() {
        const messageInput = document.getElementById('message-input');
        const text = messageInput.value.trim();

        if (!text || !this.currentRoom || !this.stompClient || !this.stompClient.connected) {
            return;
        }

        this.stompClient.send('/app/rooms/' + this.currentRoom + '/send', {},
            JSON.stringify({ text: text }));

        messageInput.value = '';
        this.handleTyping(false);
    }

    handleKeyPress(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            this.sendMessage();
        } else {
            this.handleTyping(true);
        }
    }

    handleTyping(isTyping = true) {
        if (!this.currentRoom || !this.stompClient || !this.stompClient.connected) {
            return;
        }

        // Clear existing timer
        if (this.typingTimer) {
            clearTimeout(this.typingTimer);
        }

        // Send typing start if not already typing
        if (isTyping && !this.isTyping) {
            this.isTyping = true;
            this.stompClient.send('/app/rooms/' + this.currentRoom + '/typing', {},
                JSON.stringify({ isTyping: true }));
        }

        // Set timer to send typing stop
        this.typingTimer = setTimeout(() => {
            if (this.isTyping) {
                this.isTyping = false;
                this.stompClient.send('/app/rooms/' + this.currentRoom + '/typing', {},
                    JSON.stringify({ isTyping: false }));
            }
        }, 1000);
    }

    // Room Actions
    async createRoom() {
        const name = document.getElementById('room-name').value.trim();
        const description = document.getElementById('room-description').value.trim();
        const roomType = document.getElementById('room-type').value;
        const isPrivate = document.getElementById('room-private').checked;

        if (!name) {
            this.showToast('Room name is required', 'error');
            return;
        }

        try {
            const response = await fetch('/api/rooms', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + this.token,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name, description, roomType, isPrivate })
            });

            if (response.ok) {
                const room = await response.json();
                this.closeModals();
                this.loadMyRooms();
                this.loadAvailableRooms();
                this.showToast('Room created successfully!', 'success');

                // Clear form
                document.getElementById('room-name').value = '';
                document.getElementById('room-description').value = '';
                document.getElementById('room-private').checked = false;
            } else {
                const error = await response.json();
                this.showToast(error.error || 'Failed to create room', 'error');
            }
        } catch (error) {
            console.error('Error creating room:', error);
            this.showToast('Network error. Please try again.', 'error');
        }
    }

    async joinRoom(roomId) {
        try {
            const response = await fetch(`/api/rooms/${roomId}/join`, {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + this.token,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                this.closeModals();
                this.loadMyRooms();
                this.showToast('Joined room successfully!', 'success');
            } else {
                const error = await response.json();
                this.showToast(error.error || 'Failed to join room', 'error');
            }
        } catch (error) {
            console.error('Error joining room:', error);
            this.showToast('Network error. Please try again.', 'error');
        }
    }

    async leaveRoom(roomId) {
        if (!confirm('Are you sure you want to leave this room?')) {
            return;
        }

        try {
            const response = await fetch(`/api/rooms/${roomId}/leave`, {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + this.token,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                this.loadMyRooms();
                this.showToast('Left room successfully!', 'success');

                // If it's the current room, clear chat
                if (this.currentRoom === roomId) {
                    this.currentRoom = null;
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
                this.showToast(error.error || 'Failed to leave room', 'error');
            }
        } catch (error) {
            console.error('Error leaving room:', error);
            this.showToast('Network error. Please try again.', 'error');
        }
    }

    async createDirectMessage(username) {
        try {
            const response = await fetch(`/api/chat/direct/${username}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            if (response.ok) {
                const room = await response.json();
                this.addRoom(room);
                this.selectRoom(room.id);
            }
        } catch (error) {
            this.showToast('Error creating direct message', 'error');
        }
    }


    // Status Management
    async updateStatus() {
        const newStatus = document.getElementById('status-select').value.toUpperCase();
        this.updateUserStatus(newStatus);
    }

    updateUserStatus(status) {
        if (this.stompClient && this.stompClient.connected) {
            this.stompClient.send('/app/user/status', {},
                JSON.stringify({ status: status }));
        }
    }

    // Modal Management
    showCreateRoom() {
        document.getElementById('modal-overlay').classList.remove('hidden');
        document.getElementById('create-room-modal').classList.remove('hidden');
    }

    showJoinRoom() {
        this.loadAvailableRooms();
        document.getElementById('modal-overlay').classList.remove('hidden');
        document.getElementById('join-room-modal').classList.remove('hidden');
    }

    showDirectMessage() {
        document.getElementById('modal-overlay').classList.remove('hidden');
        document.getElementById('direct-message-modal').classList.remove('hidden');
    }

    closeModals() {
        document.getElementById('modal-overlay').classList.add('hidden');
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.add('hidden');
        });
    }

    // UI Helper Methods
    toggleMembersList() {
        const membersPanel = document.getElementById('members-panel');
        membersPanel.classList.toggle('hidden');
    }

    scrollToBottom() {
        const messageArea = document.getElementById('chat-messages');
        messageArea.scrollTop = messageArea.scrollHeight;
    }

    adjustLayout() {
        // Handle responsive layout adjustments
        const isMobile = window.innerWidth < 768;
        const sidebar = document.querySelector('.sidebar');
        const mainContent = document.querySelector('.main-content');

        if (isMobile) {
            // Mobile layout adjustments
            sidebar?.classList.add('mobile');
            mainContent?.classList.add('mobile');
        } else {
            sidebar?.classList.remove('mobile');
            mainContent?.classList.remove('mobile');
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showToast(message, type = 'info', duration = 5000) {
        const toastContainer = document.getElementById('toast-container');
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

        // Auto-remove after duration
        setTimeout(() => {
            if (toast.parentElement) {
                toast.style.animation = 'fadeOut 0.3s ease forwards';
                setTimeout(() => toast.remove(), 300);
            }
        }, duration);
    }




    async startDirectMessage() {
        const phoneNumber = document.getElementById('dm-phone')?.value.trim();
        const username = document.getElementById('dm-username')?.value.trim();

        if (!phoneNumber && !username) {
            this.showToast('Please enter a phone number or username', 'error');
            return;
        }

        try {
            const response = await fetch('/api/rooms/direct-message', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + this.token,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    phoneNumber: phoneNumber || null,
                    username: username || null
                })
            });

            if (response.ok) {
                const room = await response.json();
                this.closeModals();
                this.loadMyRooms();

                // Clear inputs
                document.getElementById('dm-phone').value = '';
                document.getElementById('dm-username').value = '';

                // Select the new DM room
                this.selectRoom(room.id, room.name, room.roomType);
                this.showToast('Direct message started!', 'success');
            } else {
                const error = await response.json();
                this.showToast(error.error || 'User not found', 'error');
            }
        } catch (error) {
            console.error('Error starting direct message:', error);
            this.showToast('Failed to start direct message', 'error');
        }
    }

    // Profile & Rename Methods
    showProfile() {
        document.getElementById('profile-username').value = this.currentUser.username || '';
        document.getElementById('profile-phone').value = this.currentUser.phoneNumber || '';
        document.getElementById('profile-email').value = this.currentUser.email || '';

        document.getElementById('modal-overlay').classList.remove('hidden');
        document.getElementById('profile-modal').classList.remove('hidden');
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

                // Update UI
                document.getElementById('current-user').textContent = this.currentUser.displayName || this.currentUser.username;
                this.showToast('Profile updated successfully', 'success');
                this.closeModals();
            } else {
                const error = await response.json();
                this.showToast(error.error || 'Failed to update profile', 'error');
            }
        } catch (error) {
            console.error('Error updating profile:', error);
            this.showToast('Network error', 'error');
        }
    }

    showRenameRoom() {
        if (!this.currentRoom) return;
        const currentName = document.getElementById('current-room-name').textContent;
        document.getElementById('rename-room-input').value = currentName;
        document.getElementById('modal-overlay').classList.remove('hidden');
        document.getElementById('rename-room-modal').classList.remove('hidden');
    }

    async renameRoom() {
        const newName = document.getElementById('rename-room-input').value.trim();
        if (!newName || !this.currentRoom) return;

        try {
            const response = await fetch(`/api/rooms/${this.currentRoom}/rename`, {
                method: 'PUT',
                headers: {
                    'Authorization': 'Bearer ' + this.token,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name: newName })
            });

            if (response.ok) {
                const data = await response.json();
                document.getElementById('current-room-name').textContent = data.name;
                this.showToast('Room renamed', 'success');
                this.closeModals();
                this.loadMyRooms(); // Refresh list
            } else {
                const error = await response.json();
                this.showToast(error.error || 'Failed to rename room', 'error');
            }
        } catch (error) {
            console.error('Renaming error:', error);
            this.showToast('Network error', 'error');
        }
    }


}

// Initialize app once and bind global functions for onclick HTML usage
// Replace the entire 'DOMContentLoaded' block at the end of app.js with this.

// Replace your entire 'DOMContentLoaded' block at the end of app.js with this.

document.addEventListener('DOMContentLoaded', () => {
    // Make the app instance globally available for debugging
    window.chatApp = new ChatApp();

    // --- Auth Form Listeners ---
    document.getElementById('login-btn').addEventListener('click', () => chatApp.login());
    document.getElementById('register-btn').addEventListener('click', () => chatApp.register());
    document.getElementById('show-register-btn').addEventListener('click', () => chatApp.showRegister());
    document.getElementById('show-login-btn').addEventListener('click', () => chatApp.showLogin());

    // --- Main Chat View Button Listeners ---
    document.getElementById('show-create-room-btn').addEventListener('click', () => chatApp.showCreateRoom());
    document.getElementById('show-join-room-btn').addEventListener('click', () => chatApp.showJoinRoom());
    document.getElementById('show-dm-btn').addEventListener('click', () => chatApp.showDirectMessage());

    // --- User Status Dropdown Listener ---
    document.getElementById('status-select').addEventListener('change', () => chatApp.updateStatus());

    // --- Modal Action Button Listeners ---
    document.getElementById('create-room-btn').addEventListener('click', () => chatApp.createRoom());
    document.getElementById('start-dm-btn').addEventListener('click', () => chatApp.startDirectMessage());

    // --- Logout Button Listener ---
    document.getElementById('logout-btn').addEventListener('click', () => chatApp.logout());

    // --- Modal Cancel Button Listeners ---
    document.querySelectorAll('.cancel-modal-btn').forEach(btn => {
        btn.addEventListener('click', () => chatApp.closeModals());
    });

    document.getElementById('modal-overlay').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) {
            chatApp.closeModals();
        }
    });

    // --- Message Sending Listeners ---
    const messageInput = document.getElementById('message-input');

    // 1. Listen for the new Send Button click
    document.getElementById('send-btn').addEventListener('click', () => chatApp.sendMessage());

    // 2. Listen for the Enter key in the textarea
    messageInput.addEventListener('keydown', (e) => {
        // Send on Enter but allow new line on Shift+Enter
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault(); // Prevents a new line from being added
            chatApp.sendMessage();
        }
    });

    // 3. Handle typing indicator
    messageInput.addEventListener('keyup', () => chatApp.handleTyping());


    console.log("app.js loaded and ChatApp initialized with event listeners ✅");
});