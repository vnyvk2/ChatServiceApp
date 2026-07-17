/**
 * Auth Module - Handles login, registration, and logout.
 */
import { showToast, setButtonLoading } from './ui.js';

export async function login(app = {}) {
    const usernameInput = document.getElementById('login-username') || document.querySelector('input[name="username"]');
    const passwordInput = document.getElementById('login-password') || document.querySelector('input[name="password"]');
    const username = usernameInput?.value?.trim();
    const password = passwordInput?.value;

    const errorDiv = document.getElementById('error-message');
    if (errorDiv) errorDiv.style.display = 'none';

    if (!username || !password) {
        const msg = 'Please fill in all fields';
        if (errorDiv) {
            errorDiv.textContent = msg;
            errorDiv.style.display = 'block';
        } else {
            showToast(msg, 'error');
        }
        return;
    }

    setButtonLoading('login', true);

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok && data.token) {
            app.token = data.token;
            app.currentUser = data.user || {
                username: data.username,
                displayName: data.displayName,
                status: data.status || 'ONLINE'
            };

            localStorage.setItem('chatToken', app.token);
            localStorage.setItem('chatUser', JSON.stringify(app.currentUser));

            if (typeof app.showChatSection === 'function') {
                app.showChatSection();
                showToast('Login successful!', 'success');
            } else {
                window.location.href = '/chat.html';
            }
        } else {
            const errorMsg = data.error || 'Login failed';
            if (errorDiv) {
                errorDiv.textContent = errorMsg;
                errorDiv.style.display = 'block';
            } else {
                showToast(errorMsg, 'error');
            }
        }
    } catch (error) {
        console.error('Login error:', error);
        const netErr = 'Network error. Please try again.';
        if (errorDiv) {
            errorDiv.textContent = netErr;
            errorDiv.style.display = 'block';
        } else {
            showToast(netErr, 'error');
        }
    } finally {
        setButtonLoading('login', false);
    }
}

export async function register(app = {}) {
    const username = (document.getElementById('register-username') || document.querySelector('input[name="username"]'))?.value?.trim();
    const email = (document.getElementById('register-email') || document.querySelector('input[name="email"]'))?.value?.trim();
    const phoneNumber = (document.getElementById('register-phone') || document.querySelector('input[name="phoneNumber"]'))?.value?.trim();
    const displayName = (document.getElementById('register-displayname') || document.querySelector('input[name="displayName"]'))?.value?.trim();
    const password = (document.getElementById('register-password') || document.querySelector('input[name="password"]'))?.value;

    const errorDiv = document.getElementById('error-message');
    if (errorDiv) errorDiv.style.display = 'none';

    if (!username || !email || !displayName || !password) {
        const msg = 'Please fill in all required fields';
        if (errorDiv) {
            errorDiv.textContent = msg;
            errorDiv.style.display = 'block';
        } else {
            showToast(msg, 'error');
        }
        return;
    }

    if (password.length < 6) {
        const msg = 'Password must be at least 6 characters';
        if (errorDiv) {
            errorDiv.textContent = msg;
            errorDiv.style.display = 'block';
        } else {
            showToast(msg, 'error');
        }
        return;
    }

    setButtonLoading('register', true);

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
            app.token = data.token;
            app.currentUser = data.user || {
                username: data.username,
                displayName: data.displayName,
                status: data.status || 'OFFLINE'
            };

            localStorage.setItem('chatToken', app.token);
            localStorage.setItem('chatUser', JSON.stringify(app.currentUser));

            if (typeof app.showChatSection === 'function') {
                app.showChatSection();
                showToast('Registration successful!', 'success');
            } else {
                window.location.href = '/chat.html';
            }
        } else {
            const errorMsg = data.error || 'Registration failed';
            if (errorDiv) {
                errorDiv.textContent = errorMsg;
                errorDiv.style.display = 'block';
            } else {
                showToast(errorMsg, 'error');
            }
        }
    } catch (error) {
        console.error('Registration error:', error);
        const netErr = 'Network error. Please try again.';
        if (errorDiv) {
            errorDiv.textContent = netErr;
            errorDiv.style.display = 'block';
        } else {
            showToast(netErr, 'error');
        }
    } finally {
        setButtonLoading('register', false);
    }
}

export async function logout(app) {
    if (app.stompClient && app.stompClient.connected) {
        try { app.stompClient.disconnect(); } catch (e) { /* ignore */ }
    }

    try {
        await fetch('/api/auth/logout', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + app.token,
                'Content-Type': 'application/json'
            }
        });
    } catch (error) {
        console.error('Logout error:', error);
    }

    localStorage.removeItem('chatToken');
    localStorage.removeItem('chatUser');

    app.token = null;
    app.currentUser = null;
    app.currentRoom = null;

    const chatSection = document.getElementById('chat-section');
    const authSection = document.getElementById('auth-section');

    if (chatSection) chatSection.style.display = 'none';
    
    if (authSection) {
        authSection.style.display = 'block';
        showLogin();
    } else {
        // We are on chat.html without an auth section
        window.location.href = '/login.html';
    }

    showToast('Logged out successfully', 'success');
}

export function showLogin() {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    if (loginForm) loginForm.style.display = 'block';
    if (registerForm) registerForm.style.display = 'none';
}

export function showRegister() {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    if (loginForm) loginForm.style.display = 'none';
    if (registerForm) registerForm.style.display = 'block';
}
