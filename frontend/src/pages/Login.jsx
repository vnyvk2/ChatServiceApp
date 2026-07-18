import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function Login() {
  const { login, loading } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password) {
      setError('Please fill in all fields');
      return;
    }

    const res = await login(username.trim(), password);
    if (!res.success && res.error) {
      setError(res.error);
    }
  };

  return (
    <div id="auth-section">
      <div className="auth-container">
        <div className="auth-header">
          <h2>Welcome Back</h2>
          <p>Login to your account</p>
        </div>
        <form onSubmit={handleSubmit} id="login-form">
          <div className="form-group">
            <label htmlFor="login-username">Username</label>
            <div className="input-with-icon">
              <i className="fas fa-user"></i>
              <input
                type="text"
                id="login-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                disabled={loading}
                required
              />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="login-password">Password</label>
            <div className="input-with-icon">
              <i className="fas fa-lock"></i>
              <input
                type="password"
                id="login-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                disabled={loading}
                required
              />
            </div>
          </div>
          <button
            type="submit"
            className={`btn-primary ${loading ? 'loading' : ''}`}
            disabled={loading}
            style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
          >
            {loading ? (
              <span className="loader" style={{ display: 'inline-block' }}></span>
            ) : (
              <span>Login</span>
            )}
          </button>
          {error && (
            <div className="error-message" style={{ display: 'block', marginTop: '1rem', color: '#ef4444', textAlign: 'center' }}>
              {error}
            </div>
          )}
        </form>
        <div className="auth-footer">
          <p>Don't have an account? <Link to="/register">Sign up</Link></p>
        </div>
      </div>
    </div>
  );
}

export default Login;
