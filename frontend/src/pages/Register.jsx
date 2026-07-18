import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function Register() {
  const { register, loading } = useAuth();
  const [formData, setFormData] = useState({
    username: '',
    displayName: '',
    email: '',
    phoneNumber: '',
    password: ''
  });
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.username.trim() || !formData.displayName.trim() || !formData.email.trim() || !formData.password) {
      setError('Please fill in all required fields');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    const payload = {
      username: formData.username.trim(),
      displayName: formData.displayName.trim(),
      email: formData.email.trim(),
      phoneNumber: formData.phoneNumber.trim() || null,
      password: formData.password
    };

    const res = await register(payload);
    if (!res.success && res.error) {
      setError(res.error);
    }
  };

  return (
    <div id="auth-section">
      <div className="auth-container" style={{ maxWidth: '500px' }}>
        <div className="auth-header">
          <h2>Create Account</h2>
          <p>Join ChatService today</p>
        </div>
        <form onSubmit={handleSubmit} id="register-form">
          <div className="form-group">
            <label htmlFor="register-username">Username <span style={{ color: '#ef4444' }}>*</span></label>
            <div className="input-with-icon">
              <i className="fas fa-user"></i>
              <input
                type="text"
                id="register-username"
                name="username"
                value={formData.username}
                onChange={handleChange}
                placeholder="Choose a unique username"
                disabled={loading}
                required
              />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="register-displayname">Display Name <span style={{ color: '#ef4444' }}>*</span></label>
            <div className="input-with-icon">
              <i className="fas fa-id-badge"></i>
              <input
                type="text"
                id="register-displayname"
                name="displayName"
                value={formData.displayName}
                onChange={handleChange}
                placeholder="How should we call you?"
                disabled={loading}
                required
              />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="register-email">Email <span style={{ color: '#ef4444' }}>*</span></label>
            <div className="input-with-icon">
              <i className="fas fa-envelope"></i>
              <input
                type="email"
                id="register-email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Enter your email address"
                disabled={loading}
                required
              />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="register-phone">Phone Number (Optional)</label>
            <div className="input-with-icon">
              <i className="fas fa-phone"></i>
              <input
                type="tel"
                id="register-phone"
                name="phoneNumber"
                value={formData.phoneNumber}
                onChange={handleChange}
                placeholder="Enter your phone number"
                disabled={loading}
              />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="register-password">Password <span style={{ color: '#ef4444' }}>*</span></label>
            <div className="input-with-icon">
              <i className="fas fa-lock"></i>
              <input
                type="password"
                id="register-password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Create a strong password (min 6 chars)"
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
              <span>Sign Up</span>
            )}
          </button>
          {error && (
            <div className="error-message" style={{ display: 'block', marginTop: '1rem', color: '#ef4444', textAlign: 'center' }}>
              {error}
            </div>
          )}
        </form>
        <div className="auth-footer">
          <p>Already have an account? <Link to="/login">Login</Link></p>
        </div>
      </div>
    </div>
  );
}

export default Register;
