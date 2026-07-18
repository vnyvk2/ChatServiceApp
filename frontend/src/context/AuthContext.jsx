import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';
import { useToast } from './ToastContext';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('chatUser');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('chatToken') || null);
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  const login = async (username, password) => {
    setLoading(true);
    try {
      const response = await api.post('/api/auth/login', { username, password });
      const data = response.data;

      if (data && data.token) {
        const userData = data.user || {
          username: data.username,
          displayName: data.displayName,
          status: data.status || 'ONLINE'
        };

        localStorage.setItem('chatToken', data.token);
        localStorage.setItem('chatUser', JSON.stringify(userData));

        setToken(data.token);
        setUser(userData);
        showToast('Login successful!', 'success');
        return { success: true };
      } else {
        const errorMsg = data.error || 'Login failed';
        showToast(errorMsg, 'error');
        return { success: false, error: errorMsg };
      }
    } catch (error) {
      console.error('Login error:', error);
      const errText = error.response?.data?.error || error.response?.data?.message || 'Network error. Please try again.';
      showToast(errText, 'error');
      return { success: false, error: errText };
    } finally {
      setLoading(false);
    }
  };

  const register = async (userData) => {
    setLoading(true);
    try {
      const response = await api.post('/api/auth/register', userData);
      const data = response.data;

      if (data && data.token) {
        const userObj = data.user || {
          username: data.username,
          displayName: data.displayName,
          status: data.status || 'ONLINE'
        };

        localStorage.setItem('chatToken', data.token);
        localStorage.setItem('chatUser', JSON.stringify(userObj));

        setToken(data.token);
        setUser(userObj);
        showToast('Registration successful!', 'success');
        return { success: true };
      } else {
        const errorMsg = data.error || 'Registration failed';
        showToast(errorMsg, 'error');
        return { success: false, error: errorMsg };
      }
    } catch (error) {
      console.error('Registration error:', error);
      const errText = error.response?.data?.error || error.response?.data?.message || 'Network error. Please try again.';
      showToast(errText, 'error');
      return { success: false, error: errText };
    } finally {
      setLoading(false);
    }
  };

  const logout = async (stompClient = null) => {
    if (stompClient && stompClient.connected) {
      try { stompClient.disconnect(); } catch (e) { /* ignore */ }
    }

    try {
      if (token) {
        await api.post('/api/auth/logout');
      }
    } catch (error) {
      console.error('Logout error:', error);
    }

    localStorage.removeItem('chatToken');
    localStorage.removeItem('chatUser');
    setToken(null);
    setUser(null);
    showToast('Logged out successfully', 'success');
  };

  const updateUserInfo = (updatedUser) => {
    localStorage.setItem('chatUser', JSON.stringify(updatedUser));
    setUser(updatedUser);
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loading,
      isAuthenticated: !!token && !!user,
      login,
      register,
      logout,
      updateUserInfo
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
