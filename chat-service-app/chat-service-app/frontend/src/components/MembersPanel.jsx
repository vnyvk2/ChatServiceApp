import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

function MembersPanel({ currentRoom, onClose, onRoomUpdated }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadMembers = useCallback(async () => {
    if (!currentRoom) return;
    try {
      setLoading(true);
      const response = await api.get(`/api/rooms/${currentRoom.id}/members`);
      const data = response.data?.content || response.data || [];
      setMembers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading members:', error);
      showToast('Failed to load room members', 'error');
    } finally {
      setLoading(false);
    }
  }, [currentRoom, showToast]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const handleAdminAction = async (userId, action) => {
    try {
      if (action === 'remove') {
        await api.post(`/api/rooms/${currentRoom.id}/members/${userId}/remove`);
        setMembers((prev) => prev.filter((m) => (m.userId || m.id) !== userId));
        showToast('Member removed', 'success');
      } else if (action === 'mute') {
        await api.post(`/api/rooms/${currentRoom.id}/members/${userId}/mute`);
        showToast('Member mute status toggled', 'success');
        loadMembers();
      } else if (action === 'admin') {
        await api.post(`/api/rooms/${currentRoom.id}/members/${userId}/admin`);
        showToast('Member admin role toggled', 'success');
        loadMembers();
      }
    } catch (error) {
      showToast(`Failed to perform ${action} action`, 'error');
    }
  };

  const handleLeaveRoom = async () => {
    if (!window.confirm('Are you sure you want to leave this room?')) return;
    try {
      await api.post(`/api/rooms/${currentRoom.id}/leave`);
      showToast('Left room successfully', 'success');
      if (onRoomUpdated) onRoomUpdated();
    } catch (error) {
      showToast('Failed to leave room', 'error');
    }
  };

  const currentUserMembership = members.find((m) => (m.userId || m.id) === user?.id || m.username === user?.username);
  const isRoomAdmin = currentUserMembership?.role === 'ADMIN' || currentUserMembership?.role === 'OWNER';

  return (
    <div
      id="members-panel"
      style={{
        width: '280px',
        borderLeft: '1px solid var(--border-light)',
        background: 'var(--bg-card)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflowY: 'auto'
      }}
    >
      <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
          Members ({members.length})
        </h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
          <i className="fas fa-times"></i>
        </button>
      </div>

      <div style={{ flex: 1, padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
            <span className="loader" style={{ display: 'inline-block', marginBottom: '0.5rem' }}></span>
            <div style={{ fontSize: '0.8rem' }}>Loading members...</div>
          </div>
        ) : !Array.isArray(members) || members.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No members found.</div>
        ) : (
          members.map((member) => {
            const memberId = member.userId || member.id;
            const isSelf = memberId === user?.id || member.username === user?.username;
            const status = member.status || 'ONLINE';
            const statusColor = status === 'ONLINE' ? '#22c55e' : status === 'AWAY' ? '#eab308' : '#9ca3af';

            return (
              <div
                key={memberId || Math.random()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.5rem',
                  borderRadius: '6px',
                  background: isSelf ? 'rgba(59, 130, 246, 0.08)' : 'transparent'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
                  <div style={{ position: 'relative', width: '32px', height: '32px' }}>
                    <div className="avatar" style={{ width: '32px', height: '32px' }}>
                      <i className="fas fa-user"></i>
                    </div>
                    <span
                      style={{
                        position: 'absolute',
                        bottom: 0,
                        right: 0,
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        backgroundColor: statusColor,
                        border: '2px solid var(--bg-card)'
                      }}
                      title={status}
                    ></span>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: '500', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {member.displayName || member.username} {isSelf && '(You)'}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                      {member.role || 'MEMBER'} {member.muted && '• Muted'}
                    </div>
                  </div>
                </div>

                {isRoomAdmin && !isSelf && (
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      onClick={() => handleAdminAction(memberId, 'mute')}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: member.muted ? '#eab308' : 'var(--text-secondary)', fontSize: '0.75rem' }}
                      title={member.muted ? 'Unmute' : 'Mute'}
                    >
                      <i className={`fas ${member.muted ? 'fa-volume-up' : 'fa-volume-mute'}`}></i>
                    </button>
                    <button
                      onClick={() => handleAdminAction(memberId, 'remove')}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '0.75rem' }}
                      title="Remove Member"
                    >
                      <i className="fas fa-user-times"></i>
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <div style={{ padding: '1rem', borderTop: '1px solid var(--border-light)' }}>
        <button
          onClick={handleLeaveRoom}
          className="btn-danger-ghost"
          style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #ef4444', color: '#ef4444', cursor: 'pointer', fontSize: '0.85rem' }}
        >
          <i className="fas fa-sign-out-alt"></i> Leave Room
        </button>
      </div>
    </div>
  );
}

export default MembersPanel;
