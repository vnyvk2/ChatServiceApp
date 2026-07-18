import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import SockJS from 'sockjs-client';
import { Stomp } from '@stomp/stompjs';
import api from '../services/api';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

const WebSocketContext = createContext(null);

export const WebSocketProvider = ({ children }) => {
  const { user, token, isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const [connected, setConnected] = useState(false);
  const stompClientRef = useRef(null);
  const roomSubscriptionsRef = useRef([]);

  const markAllDeliveredOnConnect = useCallback(async () => {
    try {
      await api.post('/api/messages/mark-delivered-all');
      console.log('✅ Marked all pending messages as delivered');
    } catch (err) {
      console.error('Error marking delivered on connect:', err);
    }
  }, []);

  const connect = useCallback(() => {
    if (!isAuthenticated || !token || !user) return;
    if (stompClientRef.current && stompClientRef.current.connected) return;

    if (stompClientRef.current) {
      try { stompClientRef.current.disconnect(); } catch (e) { /* ignore */ }
    }

    const socket = new SockJS('/ws');
    const client = Stomp.over(socket);
    client.debug = () => {}; // Disable verbose STOMP logs by default

    client.connect(
      { 'Authorization': `Bearer ${token}` },
      () => {
        console.log('✅ WebSocket Connected');
        stompClientRef.current = client;
        setConnected(true);

        // Update initial status to ONLINE
        client.send('/app/user/status', {}, JSON.stringify({ status: 'ONLINE' }));
        markAllDeliveredOnConnect();

        // Global Error Subscription
        client.subscribe('/user/queue/errors', (message) => {
          const error = JSON.parse(message.body);
          console.error('WebSocket error:', error);
          showToast(`Error: ${error.message || 'Unknown socket error'}`, 'error');
        });

        // Global Notifications Subscription
        client.subscribe('/user/queue/notifications', (message) => {
          const notification = JSON.parse(message.body);
          if (notification.type === 'NEW_MESSAGE') {
            // Can trigger a custom event or toast for new messages in unactive rooms
            if ("Notification" in window && Notification.permission === "granted") {
              new Notification(`New message from ${notification.sender}`, {
                body: notification.text
              });
            }
          }
        });
      },
      (error) => {
        console.error('WebSocket connection error:', error);
        setConnected(false);
        showToast('WebSocket connection dropped. Reconnecting...', 'error');
        setTimeout(() => {
          if (localStorage.getItem('chatToken')) {
            connect();
          }
        }, 5000);
      }
    );
  }, [isAuthenticated, token, user, showToast, markAllDeliveredOnConnect]);

  const disconnect = useCallback(() => {
    if (stompClientRef.current && stompClientRef.current.connected) {
      try { stompClientRef.current.disconnect(); } catch (e) { /* ignore */ }
    }
    stompClientRef.current = null;
    setConnected(false);
  }, []);

  const unsubscribeFromRoom = useCallback(() => {
    roomSubscriptionsRef.current.forEach((sub) => {
      if (sub && sub.unsubscribe) sub.unsubscribe();
    });
    roomSubscriptionsRef.current = [];
  }, []);

  const subscribeToRoom = useCallback((roomId, { onMessage, onEvent, onTyping, onStatusUpdate }) => {
    if (!stompClientRef.current || !stompClientRef.current.connected) return;
    unsubscribeFromRoom();

    const client = stompClientRef.current;

    const msgSub = client.subscribe(`/topic/rooms/${roomId}`, (message) => {
      if (onMessage) onMessage(JSON.parse(message.body));
    });
    roomSubscriptionsRef.current.push(msgSub);

    const eventSub = client.subscribe(`/topic/rooms/${roomId}/events`, (message) => {
      if (onEvent) onEvent(JSON.parse(message.body));
    });
    roomSubscriptionsRef.current.push(eventSub);

    const typingSub = client.subscribe(`/topic/rooms/${roomId}/typing`, (message) => {
      if (onTyping) onTyping(JSON.parse(message.body));
    });
    roomSubscriptionsRef.current.push(typingSub);

    const statusSub = client.subscribe(`/topic/rooms/${roomId}/status`, (message) => {
      const statusData = JSON.parse(message.body);
      if (onStatusUpdate && statusData.type === 'MESSAGE_STATUS_UPDATE') {
        onStatusUpdate(statusData.messageIds, statusData.newStatus);
      }
    });
    roomSubscriptionsRef.current.push(statusSub);
  }, [unsubscribeFromRoom]);

  const sendMessage = useCallback((roomId, content, type = 'TEXT', replyToId = null) => {
    if (!stompClientRef.current || !stompClientRef.current.connected) return;
    stompClientRef.current.send(
      `/app/rooms/${roomId}/send`,
      {},
      JSON.stringify({ content, text: content, type, replyToId })
    );
  }, []);

  const sendTyping = useCallback((roomId, isTyping) => {
    if (!stompClientRef.current || !stompClientRef.current.connected) return;
    stompClientRef.current.send(
      `/app/rooms/${roomId}/typing`,
      {},
      JSON.stringify({ typing: isTyping })
    );
  }, []);

  const sendDelivered = useCallback((roomId) => {
    if (!stompClientRef.current || !stompClientRef.current.connected) return;
    stompClientRef.current.send(`/app/rooms/${roomId}/delivered`, {}, '{}');
  }, []);

  const sendSeen = useCallback((roomId) => {
    if (!stompClientRef.current || !stompClientRef.current.connected) return;
    stompClientRef.current.send(`/app/rooms/${roomId}/seen`, {}, '{}');
  }, []);

  const updateUserStatus = useCallback((status) => {
    if (!stompClientRef.current || !stompClientRef.current.connected) return;
    stompClientRef.current.send('/app/user/status', {}, JSON.stringify({ status }));
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      connect();
    } else {
      disconnect();
    }
    return () => {
      disconnect();
    };
  }, [isAuthenticated, connect, disconnect]);

  return (
    <WebSocketContext.Provider value={{
      connected,
      subscribeToRoom,
      unsubscribeFromRoom,
      sendMessage,
      sendTyping,
      sendDelivered,
      sendSeen,
      updateUserStatus
    }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};
