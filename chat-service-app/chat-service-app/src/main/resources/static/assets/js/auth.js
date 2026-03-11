/**
 * Auth Module - Handles login, registration, and logout.
 */
import { showToast, setButtonLoading } from './ui.js';

export async function login(app) {
    const username = document.getElementById('login-username')?.value.trim();
    const password = document.getElementById('login-password')?.value;

    if (!username || !password) {
        showToast('Please fill in all fields', 'error');
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

            app.showChatSection();
            showToast('Login successful!', 'success');
        } else {
            showToast(data.error || 'Login failed', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showToast('Network error. Please try again.', 'error');
    } finally {
        setButtonLoading('login', false);
    }
}

export async function register(app) {
    const username = document.getElementById('register-username')?.value.trim();
    const email = document.getElementById('register-email')?.value.trim();
    const phoneNumber = document.getElementById('register-phone')?.value.trim();
    const displayName = document.getElementById('register-displayname')?.value.trim();
    const password = document.getElementById('register-password')?.value;

    if (!username || !email || !displayName || !password) {
        showToast('Please fill in all required fields', 'error');
        return;
    }

    if (password.length < 6) {
        showToast('Password must be at least 6 characters', 'error');
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

            app.showChatSection();
            showToast('Registration successful!', 'success');
        } else {
            showToast(data.error || 'Registration failed', 'error');
        }
    } catch (error) {
        console.error('Registration error:', error);
        showToast('Network error. Please try again.', 'error');
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
