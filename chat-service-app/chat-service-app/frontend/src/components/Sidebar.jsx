import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

function Sidebar({
  selectedRoomId,
  onSelectRoom,
  onOpenProfileModal,
  onOpenJoinModal,
  onOpenDmModal,
  refreshRoomsTrigger
}) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadMyRooms = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/rooms/my-rooms');
      const data = response.data?.content || response.data || [];
      setRooms(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading rooms:', error);
      showToast('Failed to load your rooms', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadMyRooms();
  }, [loadMyRooms, refreshRoomsTrigger]);

  const renderRoomItem = (membership) => {
    const room = membership.room;
    if (!room) return null;

    const isSelected = room.id === selectedRoomId;
    const roomName = room.name || 'Unnamed Room';
    const isDM = room.roomType === 'DIRECT_MESSAGE';
    const icon = isDM ? 'fa-user' : room.roomType === 'BROADCAST' ? 'fa-bullhorn' : 'fa-users';

    return (
      <div
        key={room.id}
        className={`room-item ${isSelected ? 'active' : ''}`}
        onClick={() => onSelectRoom(room)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '0.75rem 1rem',
          cursor: 'pointer',
          borderRadius: '8px',
          margin: '0.2rem 0.5rem',
          backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
          transition: 'all 0.2s ease'
        }}
      >
        <div className="avatar" style={{ width: '38px', height: '38px', flexShrink: 0, position: 'relative' }}>
          <i className={`fas ${icon}`}></i>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: isSelected ? '600' : '500', color: isSelected ? 'var(--primary)' : 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {roomName}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {room.description || (isDM ? 'Direct Message' : 'Group Chat')}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="sidebar" style={{ display: 'flex', flexDirection: 'column', width: '280px', borderRight: '1px solid var(--border-light)', background: 'var(--bg-card)' }}>
      {/* Profile Header */}
      <div className="sidebar-header" style={{ padding: '1rem', borderBottom: '1px solid var(--border-light)' }}>
        <button
          onClick={onOpenProfileModal}
          className="profile-btn"
          style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textAlign: 'left', width: '100%', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          <div className="avatar" style={{ width: '42px', height: '42px', position: 'relative' }}>
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
            ) : (
              <i className="fas fa-user"></i>
            )}
          </div>
          <div className="user-info" style={{ flex: 1, minWidth: 0 }}>
            <span className="user-name" style={{ display: 'block', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.displayName || user?.username || 'My Profile'}
            </span>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              🟢 {user?.status || 'ONLINE'}
            </div>
          </div>
          <i className="fas fa-chevron-right" style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}></i>
        </button>
      </div>

      {/* Rooms List */}
      <div style={{ padding: '0.75rem 1rem 0.25rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.5px' }}>My Rooms</h3>
        <span style={{ fontSize: '0.75rem', backgroundColor: 'var(--border-light)', padding: '2px 8px', borderRadius: '12px' }}>
          {rooms.length}
        </span>
      </div>

      <div id="room-list" style={{ flex: 1, overflowY: 'auto', padding: '0.25rem 0' }}>
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <span className="loader" style={{ display: 'inline-block', marginBottom: '0.5rem' }}></span>
            <div style={{ fontSize: '0.8rem' }}>Loading rooms...</div>
          </div>
        ) : !Array.isArray(rooms) || rooms.length === 0 ? (
          <div className="no-rooms" style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            No rooms joined yet. Click below to join or create one!
          </div>
        ) : (
          rooms.map(renderRoomItem)
        )}
      </div>

      {/* Sidebar Footer Action Buttons */}
      <div className="sidebar-footer" style={{ padding: '1rem', borderTop: '1px solid var(--border-light)', display: 'flex', gap: '0.5rem' }}>
        <button
          onClick={onOpenJoinModal}
          className="btn-ghost action-icon-btn"
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.6rem', border: '1px solid var(--border-light)', borderRadius: '8px', cursor: 'pointer' }}
          title="Join or Create Room"
        >
          <i className="fas fa-door-open"></i>
          <span style={{ fontSize: '0.85rem' }}>Join / Create</span>
        </button>
        <button
          onClick={onOpenDmModal}
          className="btn-ghost action-icon-btn"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.6rem 1rem', border: '1px solid var(--border-light)', borderRadius: '8px', cursor: 'pointer' }}
          title="New Direct Message"
        >
          <i className="fas fa-comment-alt"></i>
        </button>
      </div>
    </div>
  );
}

export default Sidebar;
