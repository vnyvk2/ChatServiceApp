import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../context/WebSocketContext';
import { useToast } from '../context/ToastContext';

const CHAT_THEMES = [
  { id: 'classic', name: 'Classic', preview: 'linear-gradient(135deg, #f8fafc, #e2e8f0)', icon: '⚪' },
  { id: 'ocean', name: 'Ocean', preview: 'linear-gradient(135deg, #0c4a6e, #0e7490)', icon: '🌊' },
  { id: 'midnight', name: 'Midnight', preview: 'linear-gradient(135deg, #0f172a, #1e1b4b)', icon: '🌙' },
  { id: 'lavender', name: 'Lavender', preview: 'linear-gradient(135deg, #faf5ff, #f3e8ff)', icon: '💜' },
  { id: 'forest', name: 'Forest', preview: 'linear-gradient(135deg, #14532d, #166534)', icon: '🌲' },
  { id: 'sunset', name: 'Sunset', preview: 'linear-gradient(135deg, #fef3c7, #fecaca)', icon: '🌅' },
];

function ChatArea({ currentRoom, onToggleMembersPanel, isMembersPanelOpen, onRoomUpdated }) {
  const { user } = useAuth();
  const { subscribeToRoom, unsubscribeFromRoom, sendMessage, sendTyping, sendSeen } = useWebSocket();
  const { showToast } = useToast();

  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [inputText, setInputText] = useState('');
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [chatTheme, setChatTheme] = useState(() => localStorage.getItem('chatTheme') || 'classic');
  const [showThemePicker, setShowThemePicker] = useState(false);

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const themePickerRef = useRef(null);

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-chat-theme', chatTheme);
    localStorage.setItem('chatTheme', chatTheme);
  }, [chatTheme]);

  // Close theme picker on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (themePickerRef.current && !themePickerRef.current.contains(e.target)) {
        setShowThemePicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const loadMessages = useCallback(async (roomId) => {
    try {
      setLoadingMessages(true);
      const response = await api.get(`/api/messages/rooms/${roomId}`);
      const data = response.data?.content || response.data || [];
      const list = Array.isArray(data) ? [...data] : [];
      list.sort((a, b) => {
        const tA = new Date(a.createdAt || a.timestamp || 0).getTime();
        const tB = new Date(b.createdAt || b.timestamp || 0).getTime();
        return tA - tB;
      });
      setMessages(list);
      setTimeout(scrollToBottom, 100);
      sendSeen(roomId);
    } catch (error) {
      console.error('Error loading messages:', error);
      showToast('Failed to load messages', 'error');
    } finally {
      setLoadingMessages(false);
    }
  }, [scrollToBottom, sendSeen, showToast]);

  useEffect(() => {
    if (!currentRoom) {
      setMessages([]);
      unsubscribeFromRoom();
      return;
    }

    loadMessages(currentRoom.id);

    // Subscribe to real-time room events and messages
    subscribeToRoom(currentRoom.id, {
      onMessage: (newMsg) => {
        setMessages((prev) => {
          const list = Array.isArray(prev) ? [...prev] : [];
          // Prevent duplicates
          if (list.some((m) => m.id === newMsg.id)) return list;
          list.push(newMsg);
          list.sort((a, b) => {
            const tA = new Date(a.createdAt || a.timestamp || 0).getTime();
            const tB = new Date(b.createdAt || b.timestamp || 0).getTime();
            return tA - tB;
          });
          return list;
        });
        setTimeout(scrollToBottom, 50);
        sendSeen(currentRoom.id);
      },
      onEvent: (event) => {
        if (event.type === 'MESSAGE_DELETED' && event.messageId) {
          setMessages((prev) => (Array.isArray(prev) ? prev : []).filter((m) => m.id !== event.messageId));
        } else if (event.type === 'MESSAGE_EDITED' && event.messageId) {
          setMessages((prev) =>
            (Array.isArray(prev) ? prev : []).map((m) => (m.id === event.messageId ? { ...m, content: event.text, edited: true } : m))
          );
        } else if (event.type === 'MESSAGES_CLEARED') {
          setMessages([]);
        }
      },
      onTyping: (typingData) => {
        if (typingData.username === user?.username) return;
        setTypingUsers((prev) => {
          const next = new Set(prev);
          if (typingData.typing) {
            next.add(typingData.displayName || typingData.username);
          } else {
            next.delete(typingData.displayName || typingData.username);
          }
          return next;
        });
      },
      onStatusUpdate: (messageIds, newStatus) => {
        setMessages((prev) =>
          (Array.isArray(prev) ? prev : []).map((m) => (messageIds?.includes(m.id) ? { ...m, status: newStatus } : m))
        );
      }
    });

    return () => {
      unsubscribeFromRoom();
    };
  }, [currentRoom, loadMessages, subscribeToRoom, unsubscribeFromRoom, scrollToBottom, sendSeen, user?.username]);

  const handleInputChange = (e) => {
    setInputText(e.target.value);
    if (!currentRoom) return;

    sendTyping(currentRoom.id, true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      sendTyping(currentRoom.id, false);
    }, 2000);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || !currentRoom) return;

    if (editingMessageId) {
      try {
        await api.put(`/api/messages/rooms/${currentRoom.id}/messages/${editingMessageId}`, {
          content: inputText.trim()
        });
        setEditingMessageId(null);
        setInputText('');
      } catch (error) {
        showToast('Failed to edit message', 'error');
      }
      return;
    }

    sendMessage(currentRoom.id, inputText.trim());
    setInputText('');
    sendTyping(currentRoom.id, false);
  };

  const handleDeleteMessage = async (msgId, forEveryone = true) => {
    if (!window.confirm('Are you sure you want to delete this message?')) return;
    try {
      await api.delete(`/api/rooms/${currentRoom.id}/messages/${msgId}?forEveryone=${forEveryone}`);
      setMessages((prev) => prev.filter((m) => m.id !== msgId));
    } catch (error) {
      showToast('Failed to delete message', 'error');
    }
  };

  const startEditMessage = (msg) => {
    setEditingMessageId(msg.id);
    setInputText(msg.content || '');
  };

  const isDM = currentRoom?.roomType === 'DIRECT_MESSAGE';
  const isDarkTheme = ['ocean', 'midnight', 'forest'].includes(chatTheme);

  if (!currentRoom) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--chat-bg)', color: 'var(--text-secondary)' }}>
        <div className="welcome-message" style={{ textAlign: 'center', maxWidth: '400px', padding: '2rem' }}>
          <i className="fas fa-comments" style={{ fontSize: '3.5rem', color: 'var(--primary)', marginBottom: '1rem', opacity: 0.8 }}></i>
          <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Welcome to ChatService</h3>
          <p style={{ fontSize: '0.9rem' }}>Select a room from the sidebar or start a new conversation to begin messaging in real-time.</p>
        </div>
      </div>
    );
  }

  const typingArray = Array.from(typingUsers);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100%' }}>
      {/* Chat Header */}
      <div className="chat-header" style={{
        padding: '0.75rem 1.25rem',
        borderBottom: `1px solid var(--chat-header-border, var(--border-light))`,
        background: 'var(--chat-header-bg, var(--bg-card))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backdropFilter: 'blur(12px)',
        zIndex: 10
      }}>
        <button
          onClick={onToggleMembersPanel}
          style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: '0.25rem 0.5rem', borderRadius: '8px' }}
          title={isDM ? "View Contact Info" : "Toggle Members Panel"}
        >
          <div className="avatar" style={{ width: '40px', height: '40px' }}>
            <i className={`fas ${isDM ? 'fa-user' : 'fa-users'}`}></i>
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--chat-header-text, var(--text-primary))' }}>{currentRoom.name || 'Chat Room'}</h2>
            <div style={{ fontSize: '0.75rem', color: 'var(--chat-header-subtext, var(--text-secondary))' }}>
              {isDM ? 'Tap to view contact info' : 'Click to view members & details'}
            </div>
          </div>
        </button>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {/* Theme Picker */}
          <div style={{ position: 'relative' }} ref={themePickerRef}>
            <button
              onClick={() => setShowThemePicker(!showThemePicker)}
              className="btn-ghost"
              style={{
                padding: '0.5rem 0.75rem',
                borderRadius: '8px',
                border: `1px solid var(--chat-header-border, var(--border-light))`,
                cursor: 'pointer',
                color: 'var(--chat-header-text, var(--text-secondary))',
                background: 'var(--chat-header-bg, transparent)'
              }}
              title="Change chat theme"
            >
              <i className="fas fa-palette"></i>
            </button>

            {/* Theme Picker Popover */}
            {showThemePicker && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                background: '#ffffff',
                borderRadius: '16px',
                padding: '1rem',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(0, 0, 0, 0.05)',
                zIndex: 1000,
                width: '280px',
                animation: 'fadeIn 0.2s ease'
              }}>
                <div style={{ fontSize: '0.8rem', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.75rem', paddingLeft: '0.25rem' }}>
                  Chat Theme
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  {CHAT_THEMES.map((theme) => (
                    <button
                      key={theme.id}
                      onClick={() => { setChatTheme(theme.id); setShowThemePicker(false); }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.6rem 0.75rem',
                        borderRadius: '10px',
                        border: chatTheme === theme.id ? '2px solid var(--primary)' : '2px solid #e2e8f0',
                        background: chatTheme === theme.id ? 'rgba(59, 130, 246, 0.06)' : '#fafafa',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        textAlign: 'left'
                      }}
                    >
                      <div style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '8px',
                        background: theme.preview,
                        flexShrink: 0,
                        border: '1px solid rgba(0,0,0,0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.75rem'
                      }}>
                        {theme.icon}
                      </div>
                      <span style={{ fontSize: '0.8rem', fontWeight: chatTheme === theme.id ? '600' : '500', color: chatTheme === theme.id ? 'var(--primary)' : '#334155' }}>
                        {theme.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {!isDM && (
            <button
              onClick={onToggleMembersPanel}
              className={`btn-ghost ${isMembersPanelOpen ? 'active' : ''}`}
              style={{
                padding: '0.5rem 0.75rem',
                borderRadius: '8px',
                border: `1px solid var(--chat-header-border, var(--border-light))`,
                cursor: 'pointer',
                color: 'var(--chat-header-text, var(--text-secondary))',
                background: 'var(--chat-header-bg, transparent)'
              }}
            >
              <i className="fas fa-users"></i> Members
            </button>
          )}
        </div>
      </div>

      {/* Messages List */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        background: 'var(--chat-bg)',
        backgroundImage: 'var(--chat-bg-pattern)',
        position: 'relative'
      }}>
        {loadingMessages ? (
          <div style={{ margin: 'auto', textAlign: 'center', color: isDarkTheme ? 'rgba(255,255,255,0.6)' : 'var(--text-secondary)' }}>
            <span className="loader" style={{ display: 'inline-block', marginBottom: '0.5rem' }}></span>
            <div>Loading message history...</div>
          </div>
        ) : !Array.isArray(messages) || messages.length === 0 ? (
          <div style={{ margin: 'auto', textAlign: 'center', color: isDarkTheme ? 'rgba(255,255,255,0.5)' : 'var(--text-secondary)', fontSize: '0.9rem' }}>
            No messages yet. Be the first to say hi! 👋
          </div>
        ) : (
          messages.map((msg) => {
            const senderUsername = typeof msg.sender === 'object' ? msg.sender?.username : msg.sender;
            const senderDisplayName = typeof msg.sender === 'object' ? msg.sender?.displayName : (msg.senderDisplayName || msg.sender);
            const isMine = senderUsername === user?.username || msg.senderId === user?.id;
            const timeString = (() => {
              try {
                const raw = msg.timestamp || msg.createdAt;
                if (!raw) return '';
                const d = new Date(raw);
                return isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              } catch (e) {
                return '';
              }
            })();

            return (
              <div
                key={msg.id || Math.random()}
                className="message-container"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignSelf: isMine ? 'flex-end' : 'flex-start',
                  maxWidth: '70%',
                  animation: 'fadeIn 0.3s ease'
                }}
              >
                {!isMine && currentRoom.roomType !== 'DIRECT_MESSAGE' && (
                  <span style={{ fontSize: '0.75rem', fontWeight: '600', color: isDarkTheme ? '#93c5fd' : 'var(--primary)', marginBottom: '0.2rem', marginLeft: '0.5rem' }}>
                    {senderDisplayName || senderUsername || 'User'}
                  </span>
                )}
                <div
                  className="chat-bubble"
                  style={{
                    padding: '0.65rem 1rem',
                    borderRadius: isMine ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                    background: isMine ? 'var(--chat-bubble-mine)' : 'var(--chat-bubble-theirs)',
                    color: isMine ? 'var(--chat-bubble-text-mine)' : 'var(--chat-bubble-text-theirs)',
                    boxShadow: isMine ? 'var(--chat-bubble-shadow-mine)' : 'var(--chat-bubble-shadow-theirs)',
                    position: 'relative',
                    wordBreak: 'break-word',
                    transition: 'transform 0.1s ease',
                    backdropFilter: !isMine ? 'blur(8px)' : 'none'
                  }}
                >
                  <div style={{ fontSize: '0.95rem', lineHeight: '1.5' }}>{msg.content || msg.text}</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px', marginTop: '4px', fontSize: '0.7rem', opacity: 0.75 }}>
                    {msg.edited && <span>(edited)</span>}
                    <span style={{ color: isMine ? 'var(--chat-time-color-mine, rgba(255,255,255,0.8))' : 'var(--chat-time-color-theirs, #94a3b8)' }}>{timeString}</span>
                    {isMine && (
                      <span>
                        {msg.status === 'SEEN' ? '✓✓' : msg.status === 'DELIVERED' ? '✓✓' : '✓'}
                      </span>
                    )}
                  </div>

                  {/* Edit/Delete actions on hover for own messages */}
                  {isMine && (
                    <div className="msg-actions" style={{
                      position: 'absolute',
                      top: '-28px',
                      right: '0',
                      display: 'flex',
                      gap: '4px',
                      background: '#ffffff',
                      padding: '4px 8px',
                      borderRadius: '12px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                      opacity: 0,
                      transition: 'opacity 0.15s ease',
                      pointerEvents: 'none'
                    }}>
                      <button onClick={() => startEditMessage(msg)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.7rem', color: '#64748b', padding: '2px 4px' }} title="Edit">
                        <i className="fas fa-pen"></i>
                      </button>
                      <button onClick={() => handleDeleteMessage(msg.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.7rem', color: '#ef4444', padding: '2px 4px' }} title="Delete">
                        <i className="fas fa-trash"></i>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Typing Indicator */}
      {typingArray.length > 0 && (
        <div style={{ padding: '0.25rem 1.25rem', fontSize: '0.8rem', color: 'var(--chat-typing-color, var(--text-secondary))', fontStyle: 'italic', background: 'var(--chat-header-bg, var(--bg-card))' }}>
          {typingArray.join(', ')} {typingArray.length === 1 ? 'is' : 'are'} typing...
        </div>
      )}

      {/* Input Area */}
      <form onSubmit={handleSend} style={{
        padding: '1rem',
        borderTop: `1px solid var(--chat-header-border, var(--border-light))`,
        background: 'var(--chat-header-bg, var(--bg-card))',
        display: 'flex',
        gap: '0.5rem',
        alignItems: 'center',
        backdropFilter: 'blur(12px)'
      }}>
        {editingMessageId && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(59, 130, 246, 0.1)', padding: '0.4rem 0.75rem', borderRadius: '6px', fontSize: '0.8rem', color: 'var(--chat-header-text, var(--text-primary))' }}>
            <span>Editing message</span>
            <button type="button" onClick={() => { setEditingMessageId(null); setInputText(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}>
              <i className="fas fa-times"></i>
            </button>
          </div>
        )}
        <input
          type="text"
          value={inputText}
          onChange={handleInputChange}
          placeholder={`Message ${currentRoom.name || 'room'}...`}
          style={{
            flex: 1,
            padding: '0.75rem 1rem',
            borderRadius: '24px',
            border: `1px solid var(--chat-input-border, var(--border-light))`,
            background: 'var(--chat-input-bg, var(--bg-main))',
            color: 'var(--chat-input-text, var(--text-primary))',
            outline: 'none',
            transition: 'border-color 0.2s ease'
          }}
        />
        <button
          type="submit"
          style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'var(--primary)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)', transition: 'transform 0.15s ease' }}
        >
          <i className="fas fa-paper-plane"></i>
        </button>
      </form>
    </div>
  );
}

export default ChatArea;
