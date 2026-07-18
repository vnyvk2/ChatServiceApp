import React, { useState, useCallback } from 'react';
import Sidebar from '../components/Sidebar';
import ChatArea from '../components/ChatArea';
import MembersPanel from '../components/MembersPanel';
import ContactInfoPanel from '../components/ContactInfoPanel';
import ProfileModal from '../components/modals/ProfileModal';
import JoinCreateRoomModal from '../components/modals/JoinCreateRoomModal';
import DirectMessageModal from '../components/modals/DirectMessageModal';

function Chat() {
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [isMembersPanelOpen, setIsMembersPanelOpen] = useState(false);
  const [refreshRoomsTrigger, setRefreshRoomsTrigger] = useState(0);

  // Modal states
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [isDmModalOpen, setIsDmModalOpen] = useState(false);

  const handleSelectRoom = useCallback((room) => {
    setSelectedRoom(room);
  }, []);

  const handleToggleMembersPanel = useCallback(() => {
    setIsMembersPanelOpen((prev) => !prev);
  }, []);

  const triggerRoomsRefresh = useCallback(() => {
    setRefreshRoomsTrigger((prev) => prev + 1);
  }, []);

  const handleDmCreated = useCallback((newDmRoom) => {
    triggerRoomsRefresh();
    if (newDmRoom) {
      setSelectedRoom(newDmRoom);
    }
  }, [triggerRoomsRefresh]);

  const isDM = selectedRoom?.roomType === 'DIRECT_MESSAGE';

  return (
    <div id="chat-section" style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', background: 'var(--bg-main)' }}>
      {/* Sidebar */}
      <Sidebar
        selectedRoomId={selectedRoom?.id}
        onSelectRoom={handleSelectRoom}
        onOpenProfileModal={() => setIsProfileModalOpen(true)}
        onOpenJoinModal={() => setIsJoinModalOpen(true)}
        onOpenDmModal={() => setIsDmModalOpen(true)}
        refreshRoomsTrigger={refreshRoomsTrigger}
      />

      {/* Main Chat Window */}
      <div className="main-content" style={{ display: 'flex', flex: 1, minWidth: 0, overflow: 'hidden' }}>
        <ChatArea
          currentRoom={selectedRoom}
          onToggleMembersPanel={handleToggleMembersPanel}
          isMembersPanelOpen={isMembersPanelOpen}
          onRoomUpdated={triggerRoomsRefresh}
        />

        {/* Side Panel: ContactInfoPanel for DMs, MembersPanel for groups */}
        {selectedRoom && isMembersPanelOpen && (
          isDM ? (
            <ContactInfoPanel
              currentRoom={selectedRoom}
              onClose={() => setIsMembersPanelOpen(false)}
            />
          ) : (
            <MembersPanel
              currentRoom={selectedRoom}
              onClose={() => setIsMembersPanelOpen(false)}
              onRoomUpdated={() => {
                triggerRoomsRefresh();
                setSelectedRoom(null);
              }}
            />
          )
        )}
      </div>

      {/* Modals */}
      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />

      <JoinCreateRoomModal
        isOpen={isJoinModalOpen}
        onClose={() => setIsJoinModalOpen(false)}
        onRoomJoinedCreated={triggerRoomsRefresh}
      />

      <DirectMessageModal
        isOpen={isDmModalOpen}
        onClose={() => setIsDmModalOpen(false)}
        onDmCreated={handleDmCreated}
      />
    </div>
  );
}

export default Chat;
