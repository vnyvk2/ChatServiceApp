class ChatApp {
    constructor() {
        this.stompClient = null;
        this.currentUser = null;
        this.currentRoom = null;
        this.token = null;
        this.typingTimer = null;
        this.isTyping = false;
        // Track subscriptions to unsubscribe properly
        this.roomSubscriptions = [];
        this.init();
    }

    subscribeToRoom(roomId) {
        // Clear any existing subscriptions just in case
        this.unsubscribeFromRoom(roomId);

        // Subscribe to room messages
        const msgSub = this.stompClient.subscribe('/topic/rooms/' + roomId, (message) => {
            const messageData = JSON.parse(message.body);
            this.displayMessage(messageData);
        });
        this.roomSubscriptions.push(msgSub);

        // Subscribe to room events
        const eventSub = this.stompClient.subscribe('/topic/rooms/' + roomId + '/events', (message) => {
            const event = JSON.parse(message.body);
            this.displayEvent(event);
        });
        this.roomSubscriptions.push(eventSub);

        // Subscribe to typing indicators
        const typingSub = this.stompClient.subscribe('/topic/rooms/' + roomId + '/typing', (message) => {
            const typing = JSON.parse(message.body);
            this.displayTyping(typing);
        });
        this.roomSubscriptions.push(typingSub);
    }

    unsubscribeFromRoom(roomId) {
        // Unsubscribe from all STOMP topics for this room
        if (this.roomSubscriptions) {
            this.roomSubscriptions.forEach(sub => {
                if (sub) sub.unsubscribe();
            });
        }
        this.roomSubscriptions = [];
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
            document.getElementById('status-select').value = (this.currentUser.status || 'ONLINE');
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

    // WebSocket Methods
    connectWebSocket() {
        if (this.stompClient && this.stompClient.connected) {
            return; // Already connected
        }
        if (this.stompClient) {
            try { this.stompClient.disconnect(); } catch (e) { /* ignore */ }
        }

        const socket = new SockJS('/ws');
        this.stompClient = Stomp.over(socket);

        this.stompClient.connect(
            { 'Authorization': 'Bearer ' + this.token },
            (frame) => {
                console.log('Connected: ' + frame);
                this.onWebSocketConnected();
                // Force Status to Online
                this.updateUserStatus('ONLINE');
                // Also update the UI select if it exists
                const statusSelect = document.getElementById('status-select');
                if (statusSelect) statusSelect.value = 'ONLINE';
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

            // Use backend room.name directly to ensure DM target name renders
            const displayName = room.name;

            // Hide description for Direct Messages to avoid clutter
            const descriptionHtml = (room.roomType === 'DIRECT_MESSAGE') ? '' :
                (room.description ? `<div class="room-description">${this.escapeHtml(room.description)}</div>` : '');

            roomElement.innerHTML = `
                        <div class="room-item-header">
                            <div class="room-name">${this.escapeHtml(displayName)}</div>
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
                            <button class="btn-primary btn-small" onclick="event.stopPropagation(); chatApp.joinRoom('${room.id}')">
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
        this.currentRoomType = roomType; // Store room type

        console.log('[DEBUG selectRoom] roomId:', roomId, 'roomName:', roomName, 'roomType:', roomType);

        // Use backend roomName directly to ensure DM targets are correct
        const displayName = roomName;

        const currentRoomNameEl = document.getElementById('current-room-name');
        if (currentRoomNameEl) currentRoomNameEl.textContent = displayName;

        // Get or create the info button for DMs
        let infoBtn = document.getElementById('chat-header-info-btn');
        if (!infoBtn) {
            // Dynamically create the button since HTML may be cached
            infoBtn = document.createElement('button');
            infoBtn.id = 'chat-header-info-btn';
            infoBtn.title = 'View User Details';
            infoBtn.style.cssText = 'font-size: 1rem; color: #3b82f6; display: none; margin-left: 0.5rem; padding: 0.4rem 0.75rem; background: #e0f2fe; border-radius: 6px; border: 1px solid #3b82f6; cursor: pointer; align-items: center; gap: 0.35rem;';
            infoBtn.innerHTML = '<i class="fas fa-info-circle"></i> View Profile';
            // Insert it after the room name container
            const headerContainer = currentRoomNameEl?.closest('div[style]');
            if (headerContainer && headerContainer.parentNode) {
                headerContainer.parentNode.insertBefore(infoBtn, headerContainer.nextSibling);
            }
            // Attach the click listener
            infoBtn.addEventListener('click', () => {
                if (this.currentRoomType === 'DIRECT_MESSAGE' && this.currentRoomOtherMember) {
                    this._showUserDetailsModal(this.currentRoomOtherMember);
                } else if (this.currentRoomType === 'DIRECT_MESSAGE') {
                    this.showToast('User details are still loading...', 'info');
                }
            });
            console.log('[DEBUG] Info button created dynamically');
        }

        // Get or create the rename button for group chats
        let renameBtn = document.getElementById('rename-room-btn');
        if (!renameBtn) {
            renameBtn = document.createElement('button');
            renameBtn.id = 'rename-room-btn';
            renameBtn.title = 'Rename Chat';
            renameBtn.style.cssText = 'display: none; margin-left: 0.5rem; padding: 0.4rem 0.75rem; background: #f1f5f9; border-radius: 6px; border: 1px solid #cbd5e1; cursor: pointer; align-items: center; gap: 0.35rem;';
            renameBtn.innerHTML = '<i class="fas fa-pen"></i> Rename';
            const headerContainer = currentRoomNameEl?.closest('div[style]');
            if (headerContainer && headerContainer.parentNode) {
                headerContainer.parentNode.insertBefore(renameBtn, headerContainer.nextSibling);
            }
            renameBtn.addEventListener('click', () => this.showRenameRoom());
            console.log('[DEBUG] Rename button created dynamically');
        }

        console.log('[DEBUG selectRoom] renameBtn found:', !!renameBtn, 'infoBtn found:', !!infoBtn);

        // Toggle visibility based on room type
        if (this.currentRoomType === 'DIRECT_MESSAGE') {
            infoBtn.style.display = 'inline-flex';
            renameBtn.style.display = 'none';
        } else {
            infoBtn.style.display = 'none';
            renameBtn.style.display = 'inline-flex';
        }

        document.getElementById('chat-input-area').classList.remove('hidden');

        // Update active room styling
        document.querySelectorAll('.room-item').forEach(item => item.classList.remove('active'));
        // if event element exists, mark its closest .room-item as active
        try {
            const roomItemEl = e && (e.currentTarget || e.target) ? (e.currentTarget || e.target).closest('.room-item') : null;
            if (roomItemEl) {
                roomItemEl.classList.add('active');
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

        const statusIndicator = document.getElementById('room-status-indicator');
        if (this.currentRoomType === 'DIRECT_MESSAGE') {
            const otherMember = members.find(m => m.username !== this.currentUser.username);
            this.currentRoomOtherMember = otherMember;
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
             if (statusIndicator) statusIndicator.textContent = '';
        }

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

    displayMessages(messages) {
        const messageArea = document.getElementById('chat-messages');
        messageArea.innerHTML = '';

        if (!messages || !Array.isArray(messages)) {
            console.error("displayMessages received invalid data:", messages);
            return;
        }

        let lastMessageTime = null;

        messages.forEach(messageData => {
            const messageElement = document.createElement('div');
            const isOwnMessage = messageData.sender.username === this.currentUser.username;
            messageElement.className = `message ${isOwnMessage ? 'own' : ''}`;

            const date = messageData.createdAt ? new Date(messageData.createdAt) : new Date();
            const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            // Store timestamp in dataset for future checks
            messageElement.dataset.timestamp = timeString;

            // Only show time if it's different from the last one (simplistic grouping)
            const showTime = timeString !== lastMessageTime;
            lastMessageTime = timeString;

            const senderDisplayName = messageData.sender ? this.escapeHtml(messageData.sender.displayName) : 'Unknown User';
            const messageText = messageData.text ? this.escapeHtml(messageData.text) : '...';

            messageElement.innerHTML = `
                        <div class="message-content">
                            <div class="message-header">
                                <span class="message-sender">${senderDisplayName}</span>
                                ${showTime ? `<span class="message-time">${timeString}</span>` : ''}
                            </div>
                            <div class="message-text">${messageText}</div>
                        </div>
                    `;

            messageArea.appendChild(messageElement);
        });

        this.scrollToBottom();
    }

    displayMessage(messageData, animate = true) {
        // Deduplicate based on ID if available
        if (messageData.id && document.getElementById('msg-' + messageData.id)) {
            console.log('Duplicate message ignored:', messageData.id);
            return;
        }

        const messageArea = document.getElementById('chat-messages');
        const messageElement = document.createElement('div');
        if (messageData.id) {
            messageElement.id = 'msg-' + messageData.id;
        }

        const isOwnMessage = messageData.sender.username === this.currentUser.username;
        messageElement.className = `message ${isOwnMessage ? 'own' : ''}`;

        const date = messageData.timestamp ? new Date(messageData.timestamp) : new Date();
        const timestamp = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        // Store timestamp for future checks
        messageElement.dataset.timestamp = timestamp;

        // Check last message time to see if we should show it
        const lastMessageElement = messageArea.lastElementChild;
        const lastTime = lastMessageElement ? lastMessageElement.dataset.timestamp : null;
        const showTime = timestamp !== lastTime;

        const initials = messageData.sender.displayName.split(' ').map(n => n[0]).join('').toUpperCase();

        messageElement.innerHTML = `
                    <div class="message-avatar">${initials}</div>
                    <div class="message-content">
                        <div class="message-header">
                            <span class="message-sender">${this.escapeHtml(messageData.sender.displayName)}</span>
                            ${showTime ? `<span class="message-time">${timestamp}</span>` : ''}
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
        const timestamp = new Date(event.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });

        if (event.type === 'STATUS_UPDATE') {
            const statusIndicator = document.getElementById('room-status-indicator');
            if (statusIndicator && event.user.username !== this.currentUser.username) {
                if (event.user.status === 'ONLINE') {
                    statusIndicator.textContent = 'Online';
                } else {
                    statusIndicator.textContent = 'Last seen at ' + timestamp;
                }
            }
        } else {
            const messageArea = document.getElementById('chat-messages');
            const eventElement = document.createElement('div');
            eventElement.className = 'system-message';

            eventElement.innerHTML = `${this.escapeHtml(event.message || '')} <span style="font-size: 0.8em; opacity: 0.7;">${timestamp}</span>`;
            messageArea.appendChild(eventElement);

            this.scrollToBottom();
        }

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
                },
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

        // If Direct Message, just rename locally (nickname)
        if (this.currentRoomType === 'DIRECT_MESSAGE') {
            localStorage.setItem('room_alias_' + this.currentRoom, newName);
            document.getElementById('current-room-name').textContent = newName;
            this.showToast('Chat nickname set successfully', 'success');
            this.closeModals();
            this.loadMyRooms(); // Refresh sidebar to show new name
            return;
        }

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

    _showUserDetailsModal(member) {
        console.log('[DEBUG] _showUserDetailsModal called with:', member);

        // Ensure modal overlay exists
        let overlay = document.getElementById('modal-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'modal-overlay';
            overlay.className = 'hidden';
            overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);backdrop-filter:blur(2px);display:flex;align-items:center;justify-content:center;z-index:9999;';
            overlay.addEventListener('click', (e) => { if (e.target === e.currentTarget) this.closeModals(); });
            document.body.appendChild(overlay);
        }

        // Ensure user details modal exists
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

            // Attach listeners
            modal.querySelector('#modal-close-btn').addEventListener('click', () => this.closeModals());
            modal.querySelector('#modal-rename-btn').addEventListener('click', () => {
                this.closeModals();
                this.showRenameRoom();
            });
        }

        // Populate and show
        document.getElementById('ud-display-name').textContent = member.displayName || 'Unknown';
        document.getElementById('ud-username').textContent = member.username || 'N/A';
        document.getElementById('ud-phone').textContent = member.phoneNumber || 'N/A';
        overlay.classList.remove('hidden');
        modal.classList.remove('hidden');
    }

} // End of ChatApp class

// Initialize app once and bind global functions for onclick HTML usage
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

    // --- Header Info Button for DMs ---
    const headerInfoBtn = document.getElementById('chat-header-info-btn');
    if (headerInfoBtn) {
        headerInfoBtn.addEventListener('click', () => {
            if (chatApp.currentRoomType === 'DIRECT_MESSAGE' && chatApp.currentRoomOtherMember) {
                document.getElementById('ud-display-name').textContent = chatApp.currentRoomOtherMember.displayName || 'Unknown';
                document.getElementById('ud-username').textContent = chatApp.currentRoomOtherMember.username || 'N/A';
                document.getElementById('ud-phone').textContent = chatApp.currentRoomOtherMember.phoneNumber || 'N/A';
                document.getElementById('modal-overlay').classList.remove('hidden');
                document.getElementById('user-details-modal').classList.remove('hidden');
            } else if (chatApp.currentRoomType === 'DIRECT_MESSAGE') {
                 chatApp.showToast('User details are still loading...', 'info');
            }
        });
    }

    // --- Rename Room Trigger for Group Chats ---
    document.getElementById('rename-room-btn')?.addEventListener('click', () => chatApp.showRenameRoom());

    // --- Rename Button in Modal ---
    const modalRenameBtn = document.getElementById('modal-rename-btn');
    if (modalRenameBtn) {
        modalRenameBtn.addEventListener('click', () => {
            chatApp.closeModals();
            chatApp.showRenameRoom();
        });
    }
    
    // --- Rename Room Submit Button ---
    document.getElementById('confirm-rename-btn')?.addEventListener('click', () => chatApp.renameRoom());

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