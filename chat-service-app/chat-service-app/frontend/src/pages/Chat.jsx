import React from 'react';

function Chat() {
  const logout = () => {
    localStorage.removeItem('chatToken');
    window.location.href = '/login';
  };

  return (
    <div id="chat-section">
      <div className="sidebar">
        <div className="sidebar-header">
          <h2>My Rooms</h2>
        </div>
        <div id="room-list">
           {/* Room list will be rendered here */}
        </div>
      </div>
      <div className="main-content" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div className="chat-header">
           <h2 id="current-room-name">Select a room</h2>
           <button className="btn-danger-ghost" onClick={logout} style={{ marginLeft: 'auto' }}>Logout</button>
        </div>
        <div style={{ flex: 1, padding: '1rem', display: 'flex', flexDirection: 'column' }}>
           <div id="chat-messages" style={{ flex: 1, overflowY: 'auto' }}>
             <h3>Welcome to ChatService React App!</h3>
           </div>
        </div>
      </div>
    </div>
  );
}

export default Chat;
