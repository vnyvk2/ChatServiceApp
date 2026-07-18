import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { useToast } from '../../context/ToastContext';

function JoinCreateRoomModal({ isOpen, onClose, onRoomJoinedCreated }) {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState('search'); // 'search', 'private', 'create'

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  // Join Private State
  const [privateRoomId, setPrivateRoomId] = useState('');
  const [privatePassword, setPrivatePassword] = useState('');
  const [inviteToken, setInviteToken] = useState('');

  // Create State
  const [roomName, setRoomName] = useState('');
  const [roomDescription, setRoomDescription] = useState('');
  const [roomType, setRoomType] = useState('GROUP_CHAT');
  const [isPrivate, setIsPrivate] = useState(false);
  const [roomPassword, setRoomPassword] = useState('');
  const [creating, setCreating] = useState(false);

  const handleSearch = useCallback(async (query) => {
    try {
      setSearching(true);
      const url = query.trim() ? `/api/rooms/search?query=${encodeURIComponent(query)}` : '/api/rooms/available';
      const res = await api.get(url);
      const data = res.data?.content || res.data || [];
      setSearchResults(Array.isArray(data) ? data : []);
    } catch (error) {
      showToast('Failed to search rooms', 'error');
    } finally {
      setSearching(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (isOpen && activeTab === 'search') {
      handleSearch(searchQuery);
    }
  }, [isOpen, activeTab, handleSearch, searchQuery]);

  if (!isOpen) return null;

  const handleJoinPublic = async (roomId) => {
    try {
      await api.post(`/api/rooms/${roomId}/join`, {});
      showToast('Joined room successfully!', 'success');
      onRoomJoinedCreated();
      onClose();
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to join room', 'error');
    }
  };

  const handleJoinPrivate = async (e) => {
    e.preventDefault();
    try {
      if (inviteToken.trim()) {
        await api.post(`/api/rooms/join-by-token?token=${encodeURIComponent(inviteToken.trim())}`);
      } else if (privateRoomId.trim()) {
        await api.post(`/api/rooms/${privateRoomId.trim()}/join`, {
          password: privatePassword || null
        });
      } else {
        showToast('Please enter a Room ID or Invite Token', 'error');
        return;
      }
      showToast('Joined private room successfully!', 'success');
      onRoomJoinedCreated();
      onClose();
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to join private room', 'error');
    }
  };

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    if (!roomName.trim()) {
      showToast('Please provide a room name', 'error');
      return;
    }

    setCreating(true);
    try {
      const payload = {
        name: roomName.trim(),
        description: roomDescription.trim() || null,
        roomType: roomType,
        isPrivate: isPrivate,
        password: isPrivate && roomPassword ? roomPassword : null
      };

      await api.post('/api/rooms', payload);
      showToast('Room created successfully!', 'success');
      onRoomJoinedCreated();
      onClose();
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to create room', 'error');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="modal" style={{ background: 'var(--bg-card)', padding: '1.5rem', borderRadius: '12px', width: '90%', maxWidth: '500px', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.75rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>Room Management</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
            <i className="fas fa-times"></i>
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '2px solid var(--border-light)', marginBottom: '1rem' }}>
          {[
            { id: 'search', label: 'Search Public' },
            { id: 'private', label: 'Join Private' },
            { id: 'create', label: 'Create Room' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1,
                padding: '0.6rem',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontWeight: activeTab === tab.id ? '600' : '500',
                color: activeTab === tab.id ? 'var(--primary)' : 'var(--text-secondary)',
                borderBottom: activeTab === tab.id ? '2px solid var(--primary)' : '2px solid transparent',
                marginBottom: '-2px',
                transition: 'all 0.2s'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab 1: Search */}
        {activeTab === 'search' && (
          <div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search public rooms..."
              style={{ width: '100%', padding: '0.6rem 1rem', borderRadius: '20px', border: '1px solid var(--border-light)', background: 'var(--bg-main)', color: 'var(--text-primary)', marginBottom: '1rem' }}
            />

            <div style={{ maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {searching ? (
                <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-secondary)' }}>Searching...</div>
              ) : !Array.isArray(searchResults) || searchResults.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No public rooms found.</div>
              ) : (
                searchResults.map((room) => (
                  <div key={room.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                    <div>
                      <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{room.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{room.description || 'Public Group Chat'}</div>
                    </div>
                    <button
                      onClick={() => handleJoinPublic(room.id)}
                      style={{ padding: '0.4rem 0.8rem', borderRadius: '6px', background: 'var(--primary)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '0.8rem' }}
                    >
                      Join
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Join Private */}
        {activeTab === 'private' && (
          <form onSubmit={handleJoinPrivate} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>Room ID</label>
              <input type="text" value={privateRoomId} onChange={(e) => setPrivateRoomId(e.target.value)} placeholder="Enter room ID" style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid var(--border-light)', background: 'var(--bg-main)', color: 'var(--text-primary)' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>Password (if required)</label>
              <input type="password" value={privatePassword} onChange={(e) => setPrivatePassword(e.target.value)} placeholder="Enter room password" style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid var(--border-light)', background: 'var(--bg-main)', color: 'var(--text-primary)' }} />
            </div>

            <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.8rem', margin: '0.5rem 0' }}>— OR —</div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>Invite Token / Link</label>
              <input type="text" value={inviteToken} onChange={(e) => setInviteToken(e.target.value)} placeholder="Paste invite token" style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid var(--border-light)', background: 'var(--bg-main)', color: 'var(--text-primary)' }} />
            </div>

            <button type="submit" style={{ marginTop: '0.5rem', padding: '0.6rem', borderRadius: '6px', background: 'var(--primary)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: '600' }}>
              Join Private Room
            </button>
          </form>
        )}

        {/* Tab 3: Create Room */}
        {activeTab === 'create' && (
          <form onSubmit={handleCreateRoom} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>Room Name *</label>
              <input type="text" value={roomName} onChange={(e) => setRoomName(e.target.value)} placeholder="Give your room a name" style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid var(--border-light)', background: 'var(--bg-main)', color: 'var(--text-primary)' }} required />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>Description</label>
              <textarea value={roomDescription} onChange={(e) => setRoomDescription(e.target.value)} placeholder="What is this room about?" rows={2} style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid var(--border-light)', background: 'var(--bg-main)', color: 'var(--text-primary)' }} />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>Room Type</label>
              <select value={roomType} onChange={(e) => setRoomType(e.target.value)} style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid var(--border-light)', background: 'var(--bg-main)', color: 'var(--text-primary)' }}>
                <option value="GROUP_CHAT">Group Chat (Everyone can chat)</option>
                <option value="BROADCAST">Broadcast (Only admins can post)</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
              <input type="checkbox" id="isPrivateCheck" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} />
              <label htmlFor="isPrivateCheck" style={{ fontSize: '0.85rem', cursor: 'pointer' }}>Make this room Private (Requires invite or password)</label>
            </div>

            {isPrivate && (
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>Room Password (Optional)</label>
                <input type="password" value={roomPassword} onChange={(e) => setRoomPassword(e.target.value)} placeholder="Set a password for joining" style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid var(--border-light)', background: 'var(--bg-main)', color: 'var(--text-primary)' }} />
              </div>
            )}

            <button type="submit" disabled={creating} style={{ marginTop: '0.5rem', padding: '0.6rem', borderRadius: '6px', background: 'var(--primary)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: '600' }}>
              {creating ? 'Creating...' : 'Create Room'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default JoinCreateRoomModal;
