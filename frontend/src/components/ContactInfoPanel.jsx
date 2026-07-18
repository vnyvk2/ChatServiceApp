import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

function ContactInfoPanel({ currentRoom, onClose }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [contactUser, setContactUser] = useState(null);
  const [contactProfile, setContactProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadContactInfo = useCallback(async () => {
    if (!currentRoom) return;
    try {
      setLoading(true);

      // Get room members to find the other user
      const membersRes = await api.get(`/api/rooms/${currentRoom.id}/members`);
      const members = membersRes.data?.content || membersRes.data || [];
      const otherMember = Array.isArray(members)
        ? members.find((m) => {
            const memberId = m.userId || m.id;
            const memberUsername = m.username;
            return memberId !== user?.id && memberUsername !== user?.username;
          })
        : null;

      if (!otherMember) {
        setLoading(false);
        return;
      }

      const otherUserId = otherMember.userId || otherMember.id;
      const otherUsername = otherMember.username;
      const identifier = otherUserId || otherUsername;

      // Fetch user info and profile in parallel
      const [userRes, profileRes] = await Promise.allSettled([
        api.get(`/api/users/${identifier}`),
        api.get(`/api/profiles/${identifier}`)
      ]);

      if (userRes.status === 'fulfilled') {
        setContactUser(userRes.value.data);
      } else {
        // Fallback to member data
        setContactUser(otherMember);
      }

      if (profileRes.status === 'fulfilled') {
        setContactProfile(profileRes.value.data);
      }
    } catch (error) {
      console.error('Error loading contact info:', error);
      showToast('Failed to load contact info', 'error');
    } finally {
      setLoading(false);
    }
  }, [currentRoom, user, showToast]);

  useEffect(() => {
    loadContactInfo();
  }, [loadContactInfo]);

  const statusColor = contactUser?.status === 'ONLINE' ? '#22c55e' : contactUser?.status === 'AWAY' ? '#eab308' : '#9ca3af';
  const statusLabel = contactUser?.status === 'ONLINE' ? 'Online' : contactUser?.status === 'AWAY' ? 'Away' : 'Offline';
  const avatarUrl = contactProfile?.avatarUrl || contactUser?.avatarUrl;
  const displayName = contactUser?.displayName || contactUser?.username || 'User';
  const username = contactUser?.username || '';

  return (
    <div
      id="contact-info-panel"
      style={{
        width: '320px',
        borderLeft: '1px solid var(--border-light)',
        background: 'var(--bg-card)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflowY: 'auto'
      }}
    >
      {/* Close button */}
      <div style={{
        padding: '1rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid var(--border-light)'
      }}>
        <h3 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-primary)', fontWeight: '600' }}>
          Contact Info
        </h3>
        <button onClick={onClose} style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-secondary)',
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background 0.2s'
        }}>
          <i className="fas fa-times"></i>
        </button>
      </div>

      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '0.5rem', color: 'var(--text-secondary)' }}>
          <span className="loader" style={{ display: 'inline-block' }}></span>
          <div style={{ fontSize: '0.85rem' }}>Loading contact info...</div>
        </div>
      ) : (
        <>
          {/* Profile Header Card */}
          <div style={{
            padding: '2rem 1.5rem',
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, rgba(147, 51, 234, 0.05) 100%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.75rem',
            borderBottom: '1px solid var(--border-light)'
          }}>
            {/* Avatar */}
            <div style={{
              width: '90px',
              height: '90px',
              borderRadius: '50%',
              background: avatarUrl ? 'transparent' : 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              boxShadow: '0 4px 20px rgba(59, 130, 246, 0.2)',
              border: '3px solid #ffffff',
              position: 'relative'
            }}>
              {avatarUrl ? (
                <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <i className="fas fa-user" style={{ fontSize: '2.5rem', color: '#ffffff' }}></i>
              )}
            </div>

            {/* Name & Status */}
            <div style={{ textAlign: 'center' }}>
              <h3 style={{
                margin: '0 0 0.25rem',
                fontSize: '1.2rem',
                fontWeight: '700',
                color: 'var(--text-primary)',
                letterSpacing: '-0.01em'
              }}>
                {displayName}
              </h3>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                marginBottom: '0.5rem'
              }}>
                <span style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: statusColor,
                  display: 'inline-block'
                }}></span>
                <span style={{
                  fontSize: '0.8rem',
                  color: 'var(--text-secondary)',
                  fontWeight: '500',
                  textTransform: 'capitalize'
                }}>
                  {statusLabel}
                </span>
              </div>
            </div>
          </div>

          {/* Info Sections */}
          <div style={{ padding: '0.75rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {/* Username */}
            {username && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.85rem',
                padding: '0.85rem 0.75rem',
                borderRadius: '10px',
                transition: 'background 0.15s ease'
              }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'rgba(59, 130, 246, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--primary)',
                  flexShrink: 0
                }}>
                  <i className="fas fa-at" style={{ fontSize: '0.85rem' }}></i>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.15rem' }}>
                    Username
                  </div>
                  <div style={{ fontSize: '0.9rem', fontWeight: '500', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    @{username}
                  </div>
                </div>
              </div>
            )}

            {/* Phone Number */}
            {contactUser?.phoneNumber && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.85rem',
                padding: '0.85rem 0.75rem',
                borderRadius: '10px',
                transition: 'background 0.15s ease'
              }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'rgba(34, 197, 94, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#16a34a',
                  flexShrink: 0
                }}>
                  <i className="fas fa-phone" style={{ fontSize: '0.85rem' }}></i>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.15rem' }}>
                    Phone
                  </div>
                  <div style={{ fontSize: '0.9rem', fontWeight: '500', color: 'var(--text-primary)' }}>
                    {contactUser.phoneNumber}
                  </div>
                </div>
              </div>
            )}

            {/* Email */}
            {contactUser?.email && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.85rem',
                padding: '0.85rem 0.75rem',
                borderRadius: '10px',
                transition: 'background 0.15s ease'
              }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'rgba(168, 85, 247, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#9333ea',
                  flexShrink: 0
                }}>
                  <i className="fas fa-envelope" style={{ fontSize: '0.85rem' }}></i>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.15rem' }}>
                    Email
                  </div>
                  <div style={{ fontSize: '0.9rem', fontWeight: '500', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {contactUser.email}
                  </div>
                </div>
              </div>
            )}

            {/* Bio */}
            {contactProfile?.bio && (
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.85rem',
                padding: '0.85rem 0.75rem',
                borderRadius: '10px',
                transition: 'background 0.15s ease'
              }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'rgba(249, 115, 22, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ea580c',
                  flexShrink: 0
                }}>
                  <i className="fas fa-info-circle" style={{ fontSize: '0.85rem' }}></i>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.15rem' }}>
                    About
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: '1.5' }}>
                    {contactProfile.bio}
                  </div>
                </div>
              </div>
            )}

            {/* Last Seen */}
            {contactUser?.lastSeenAt && contactUser?.status !== 'ONLINE' && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.85rem',
                padding: '0.85rem 0.75rem',
                borderRadius: '10px',
                transition: 'background 0.15s ease'
              }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'rgba(100, 116, 139, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#64748b',
                  flexShrink: 0
                }}>
                  <i className="fas fa-clock" style={{ fontSize: '0.85rem' }}></i>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.15rem' }}>
                    Last Seen
                  </div>
                  <div style={{ fontSize: '0.85rem', fontWeight: '500', color: 'var(--text-primary)' }}>
                    {new Date(contactUser.lastSeenAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                  </div>
                </div>
              </div>
            )}

            {/* No info fallback */}
            {!contactUser?.phoneNumber && !contactUser?.email && !contactProfile?.bio && (
              <div style={{
                textAlign: 'center',
                padding: '1.5rem',
                color: 'var(--text-secondary)',
                fontSize: '0.85rem',
                fontStyle: 'italic'
              }}>
                This user hasn't shared additional contact info.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default ContactInfoPanel;
