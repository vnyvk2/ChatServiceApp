import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { WebSocketProvider } from './context/WebSocketContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Chat from './pages/Chat';
import './assets/style.css';

function ProtectedRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/chat" />} />
      <Route path="/register" element={!isAuthenticated ? <Register /> : <Navigate to="/chat" />} />
      <Route path="/chat" element={isAuthenticated ? <Chat /> : <Navigate to="/login" />} />
      <Route path="/" element={<Navigate to={isAuthenticated ? "/chat" : "/login"} />} />
    </Routes>
  );
}

function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <WebSocketProvider>
          <Router>
            <ProtectedRoutes />
          </Router>
        </WebSocketProvider>
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;
