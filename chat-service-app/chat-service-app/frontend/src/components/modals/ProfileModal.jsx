import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useWebSocket } from '../../context/WebSocketContext';
import { useToast } from '../../context/ToastContext';

const PRIVACY_OPTIONS = [
  { value: 'PUBLIC', label: 'Public', icon: 'fa-globe', desc: 'Anyone can see' },
  { value: 'CONNECTIONS', label: 'Connections', icon: 'fa-user-friends', desc: 'Only direct connections' },
  { value: 'NOBODY', label: 'Nobody', icon: 'fa-eye-slash', desc: 'Hidden from everyone' },
];

function ProfileModal({ isOpen, onClose }) {
  const { user, logout, updateUserInfo } = useAuth();
  const { updateUserStatus } = useWebSocket();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState('profile');

  // Profile fields
  const [displayName, setDisplayName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('ONLINE');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);

  // Privacy fields
  const [readReceipts, setReadReceipts] = useState(true);
  const [showOnlineStatus, setShowOnlineStatus] = useState(true);
  const [lastSeenVisible, setLastSeenVisible] = useState(true);
  const [usernameVisibility, setUsernameVisibility] = useState('PUBLIC');
  const [displayNameVisibility, setDisplayNameVisibility] = useState('PUBLIC');
  const [phoneVisibility, setPhoneVisibility] = useState('CONNECTIONS');
  const [emailVisibility, setEmailVisibility] = useState('CONNECTIONS');
  const [profilePicVisibility, setProfilePicVisibility] = useState('PUBLIC');
  const [savingPrivacy, setSavingPrivacy] = useState(false);

  const prevIsOpenRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      setActiveTab('profile');
      prevIsOpenRef.current = false;
      return;
    }

    if (isOpen && !prevIsOpenRef.current) {
      prevIsOpenRef.current = true;
      if (user) {
        setDisplayName(user.displayName || user.username || '');
        setPhoneNumber(user.phoneNumber || '');
        setEmail(user.email || '');
        setStatus(user.status || 'ONLINE');
      }
      loadPrivacySettings();
      loadProfileData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const loadPrivacySettings = useCallback(async () => {
    try {
      const [privacyRes, readRes, onlineRes, lastSeenRes] = await Promise.allSettled([
        api.get('/api/users/privacy'),
        api.get('/api/users/read-receipts'),
        api.get('/api/users/online-status'),
        api.get('/api/users/last-seen-visibility'),
      ]);

      if (privacyRes.status === 'fulfilled' && privacyRes.value?.data) {
        setUsernameVisibility(privacyRes.value.data.usernameVisibility || 'PUBLIC');
        setDisplayNameVisibility(privacyRes.value.data.displayNameVisibility || 'PUBLIC');
        setPhoneVisibility(privacyRes.value.data.phoneVisibility || 'CONNECTIONS');
        setEmailVisibility(privacyRes.value.data.emailVisibility || 'CONNECTIONS');
      }

      if (readRes.status === 'fulfilled' && readRes.value?.data) {
        setReadReceipts(readRes.value.data.readReceiptsEnabled ?? true);
      }

      if (onlineRes.status === 'fulfilled' && onlineRes.value?.data) {
        setShowOnlineStatus(onlineRes.value.data.showOnlineStatus ?? true);
      }

      if (lastSeenRes.status === 'fulfilled' && lastSeenRes.value?.data) {
        setLastSeenVisible(lastSeenRes.value.data.lastSeenVisible ?? true);
      }
    } catch (error) {
      console.error('Error loading privacy settings:', error);
    }
  }, []);

  const loadProfileData = useCallback(async () => {
    try {
      const res = await api.get('/api/profiles/me');
      if (res.data) {
        setBio(res.data.bio || '');
        let picVis = res.data.profilePicVisibility || 'PUBLIC';
        if (picVis === 'EVERYONE') picVis = 'PUBLIC';
        if (picVis === 'CONTACTS') picVis = 'CONNECTIONS';
        setProfilePicVisibility(picVis);
        if (res.data.avatarUrl && user && res.data.avatarUrl !== user.avatarUrl) {
          updateUserInfo({ ...user, avatarUrl: res.data.avatarUrl });
        }
      }
    } catch (error) {
      console.error('Error loading profile data:', error);
    }
  }, [user, updateUserInfo]);

  if (!isOpen) return null;

  const handleStatusChange = (e) => {
    const newStatus = e.target.value;
    setStatus(newStatus);
    updateUserStatus(newStatus);
    if (user) {
      updateUserInfo({ ...user, status: newStatus });
    }
    showToast(`Status set to ${newStatus}`, 'info');
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/api/users/profile', {
        displayName,
        phoneNumber,
        email
      });

      // Also update bio if set
      if (user) {
        const userId = user.id || user.userId;
        if (userId) {
          await api.put(`/api/profiles/${userId}`, {
            bio,
            profilePicVisibility
          });
        }
      }

      if (user) {
        updateUserInfo({
          ...user,
          displayName,
          phoneNumber,
          email,
          status
        });
      }
      showToast('Profile updated successfully!', 'success');
    } catch (error) {
      console.error('Error saving profile:', error);
      showToast(error.response?.data?.error || 'Failed to save profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePrivacy = async () => {
    setSavingPrivacy(true);
    try {
      // Save per-field visibility
      await api.put('/api/users/privacy', {
        usernameVisibility,
        displayNameVisibility,
        phoneVisibility,
        emailVisibility
      });

      // Save profile pic visibility
      if (user) {
        const userId = user.id || user.userId;
        if (userId) {
          await api.put(`/api/profiles/${userId}`, {
            profilePicVisibility
          });
        }
      }

      // Save toggle settings
      await Promise.allSettled([
        api.put('/api/users/read-receipts', { readReceiptsEnabled: readReceipts }),
        api.put('/api/users/online-status', { showOnlineStatus }),
        api.put('/api/users/last-seen-visibility', { lastSeenVisible }),
      ]);

      showToast('Privacy settings saved!', 'success');
    } catch (error) {
      console.error('Error saving privacy:', error);
      showToast('Failed to save privacy settings', 'error');
    } finally {
      setSavingPrivacy(false);
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const userId = user.id || user.userId;
      const res = await api.post(`/api/profiles/${userId}/avatar`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data && res.data.avatarUrl) {
        updateUserInfo({ ...user, avatarUrl: res.data.avatarUrl });
        showToast('Avatar updated!', 'success');
      }
    } catch (error) {
      console.error('Avatar upload error:', error);
      showToast(error.response?.data?.error || 'Failed to upload avatar', 'error');
    }
  };

  const PrivacySelect = ({ value, onChange, label }) => (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0.85rem 1rem',
      background: 'var(--bg-main)',
      borderRadius: '10px',
      transition: 'all 0.15s ease'
    }}>
      <span style={{ fontSize: '0.85rem', fontWeight: '500', color: 'var(--text-primary)' }}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          padding: '0.4rem 0.6rem',
          borderRadius: '8px',
          border: '1px solid var(--border-light)',
          background: 'var(--bg-card)',
          color: 'var(--text-primary)',
          fontSize: '0.8rem',
          fontWeight: '500',
          cursor: 'pointer',
          minWidth: '130px'
        }}
      >
        {PRIVACY_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );

  const ToggleSwitch = ({ checked, onChange, label }) => (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0.85rem 1rem',
      background: 'var(--bg-main)',
      borderRadius: '10px'
    }}>
      <span style={{ fontSize: '0.85rem', fontWeight: '500', color: 'var(--text-primary)' }}>{label}</span>
      <label className="toggle-switch">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="toggle-slider"></span>
      </label>
    </div>
  );

  return (
    <div className="modal-overlay" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      backdropFilter: 'blur(4px)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      animation: 'fadeIn 0.2s ease'
    }}>
      <div className="profile-modal" style={{
        background: 'var(--bg-card)',
        borderRadius: '20px',
        width: '90%',
        maxWidth: '480px',
        maxHeight: '88vh',
        overflowY: 'auto',
        boxShadow: '0 25px 60px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05)',
        animation: 'scaleIn 0.25s ease'
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--border-light)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'sticky',
          top: 0,
          background: 'var(--bg-card)',
          borderRadius: '20px 20px 0 0',
          zIndex: 10
        }}>
          <h3 style={{
            margin: 0,
            fontSize: '1.15rem',
            fontWeight: '700',
            color: 'var(--text-primary)',
            letterSpacing: '-0.01em'
          }}>
            My Profile & Settings
          </h3>
          <button onClick={onClose} style={{
            background: 'var(--bg-main)',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-secondary)',
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s ease'
          }}>
            <i className="fas fa-times"></i>
          </button>
        </div>

        {/* Tab Navigation */}
        <div style={{
          display: 'flex',
          padding: '0 1.5rem',
          gap: '0.25rem',
          background: 'var(--bg-card)',
          borderBottom: '1px solid var(--border-light)'
        }}>
          <button
            onClick={() => setActiveTab('profile')}
            style={{
              flex: 1,
              padding: '0.85rem 0',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: activeTab === 'profile' ? '600' : '500',
              color: activeTab === 'profile' ? 'var(--primary)' : 'var(--text-secondary)',
              background: 'transparent',
              borderBottom: activeTab === 'profile' ? '2.5px solid var(--primary)' : '2.5px solid transparent',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem'
            }}
          >
            <i className="fas fa-user-circle"></i> Profile
          </button>
          <button
            onClick={() => setActiveTab('privacy')}
            style={{
              flex: 1,
              padding: '0.85rem 0',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: activeTab === 'privacy' ? '600' : '500',
              color: activeTab === 'privacy' ? 'var(--primary)' : 'var(--text-secondary)',
              background: 'transparent',
              borderBottom: activeTab === 'privacy' ? '2.5px solid var(--primary)' : '2.5px solid transparent',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem'
            }}
          >
            <i className="fas fa-shield-alt"></i> Privacy
          </button>
        </div>

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div style={{ padding: '1.25rem 1.5rem' }}>
            {/* Avatar Section */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              marginBottom: '1.5rem',
              padding: '1.5rem',
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.04) 0%, rgba(147, 51, 234, 0.04) 100%)',
              borderRadius: '16px'
            }}>
              <label htmlFor="avatar-file-input" style={{
                position: 'relative',
                cursor: 'pointer',
                width: '90px',
                height: '90px',
                borderRadius: '50%',
                overflow: 'hidden',
                border: '3px solid var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--bg-main)',
                boxShadow: '0 4px 15px rgba(59, 130, 246, 0.15)',
                transition: 'transform 0.2s ease'
              }}>
                {user?.avatarUrl ? (
                  <img src={user.avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <i className="fas fa-user" style={{ fontSize: '2.2rem', color: 'var(--text-secondary)' }}></i>
                )}
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  background: 'rgba(0, 0, 0, 0.6)',
                  color: '#fff',
                  textAlign: 'center',
                  padding: '4px 0',
                  fontSize: '0.65rem'
                }}>
                  <i className="fas fa-camera"></i>
                </div>
              </label>
              <input type="file" id="avatar-file-input" accept="image/*" onChange={handleAvatarUpload} style={{ display: 'none' }} />
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Click to change photo</p>
            </div>

            <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {/* Status */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</label>
                <select value={status} onChange={handleStatusChange} style={{
                  width: '100%',
                  padding: '0.65rem 0.75rem',
                  borderRadius: '10px',
                  border: '1px solid var(--border-light)',
                  background: 'var(--bg-main)',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                  cursor: 'pointer'
                }}>
                  <option value="ONLINE">🟢 Online</option>
                  <option value="AWAY">🟡 Away</option>
                  <option value="OFFLINE">⚫ Offline</option>
                </select>
              </div>

              {/* Display Name */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Display Name</label>
                <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} style={{
                  width: '100%',
                  padding: '0.65rem 0.75rem',
                  borderRadius: '10px',
                  border: '1px solid var(--border-light)',
                  background: 'var(--bg-main)',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem'
                }} required />
              </div>

              {/* Phone Number */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Phone Number</label>
                <input type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="Phone number" style={{
                  width: '100%',
                  padding: '0.65rem 0.75rem',
                  borderRadius: '10px',
                  border: '1px solid var(--border-light)',
                  background: 'var(--bg-main)',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem'
                }} />
              </div>

              {/* Email */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" style={{
                  width: '100%',
                  padding: '0.65rem 0.75rem',
                  borderRadius: '10px',
                  border: '1px solid var(--border-light)',
                  background: 'var(--bg-main)',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem'
                }} />
              </div>

              {/* Bio */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>About / Bio</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell people about yourself..."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.75rem',
                    borderRadius: '10px',
                    border: '1px solid var(--border-light)',
                    background: 'var(--bg-main)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                    resize: 'vertical',
                    fontFamily: 'inherit'
                  }}
                />
              </div>

              <button type="submit" disabled={saving} style={{
                padding: '0.75rem',
                borderRadius: '12px',
                border: 'none',
                background: saving ? '#94a3b8' : 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)',
                color: '#fff',
                cursor: saving ? 'not-allowed' : 'pointer',
                fontSize: '0.9rem',
                fontWeight: '600',
                boxShadow: saving ? 'none' : '0 4px 12px rgba(59, 130, 246, 0.3)',
                transition: 'all 0.2s ease',
                marginTop: '0.5rem'
              }}>
                {saving ? 'Saving...' : 'Save Profile'}
              </button>
            </form>
          </div>
        )}

        {/* Privacy Tab */}
        {activeTab === 'privacy' && (
          <div style={{ padding: '1.25rem 1.5rem' }}>
            {/* Field Visibility Section */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{
                fontSize: '0.72rem',
                fontWeight: '700',
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.6px',
                marginBottom: '0.6rem',
                paddingLeft: '0.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}>
                <i className="fas fa-eye" style={{ fontSize: '0.7rem' }}></i> Who can see your info
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <PrivacySelect label="Username" value={usernameVisibility} onChange={setUsernameVisibility} />
                <PrivacySelect label="Display Name" value={displayNameVisibility} onChange={setDisplayNameVisibility} />
                <PrivacySelect label="Phone Number" value={phoneVisibility} onChange={setPhoneVisibility} />
                <PrivacySelect label="Profile Picture" value={profilePicVisibility} onChange={setProfilePicVisibility} />
              </div>
            </div>

            {/* Toggle Section */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{
                fontSize: '0.72rem',
                fontWeight: '700',
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.6px',
                marginBottom: '0.6rem',
                paddingLeft: '0.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}>
                <i className="fas fa-toggle-on" style={{ fontSize: '0.7rem' }}></i> Activity & Receipts
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <ToggleSwitch label="Read Receipts (Blue Ticks)" checked={readReceipts} onChange={setReadReceipts} />
                <ToggleSwitch label="Show Online Status" checked={showOnlineStatus} onChange={setShowOnlineStatus} />
                <ToggleSwitch label="Show Last Seen" checked={lastSeenVisible} onChange={setLastSeenVisible} />
              </div>
            </div>

            <button onClick={handleSavePrivacy} disabled={savingPrivacy} style={{
              width: '100%',
              padding: '0.75rem',
              borderRadius: '12px',
              border: 'none',
              background: savingPrivacy ? '#94a3b8' : 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)',
              color: '#fff',
              cursor: savingPrivacy ? 'not-allowed' : 'pointer',
              fontSize: '0.9rem',
              fontWeight: '600',
              boxShadow: savingPrivacy ? 'none' : '0 4px 12px rgba(59, 130, 246, 0.3)',
              transition: 'all 0.2s ease'
            }}>
              {savingPrivacy ? 'Saving...' : 'Save Privacy Settings'}
            </button>
          </div>
        )}

        {/* Logout */}
        <div style={{
          padding: '1rem 1.5rem 1.5rem',
          borderTop: '1px solid var(--border-light)'
        }}>
          <button
            onClick={() => { onClose(); logout(); }}
            style={{
              width: '100%',
              padding: '0.7rem',
              borderRadius: '12px',
              border: 'none',
              background: 'rgba(239, 68, 68, 0.06)',
              color: '#ef4444',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s ease'
            }}
          >
            <i className="fas fa-sign-out-alt"></i> Logout
          </button>
        </div>
      </div>
    </div>
  );
}

export default ProfileModal;
