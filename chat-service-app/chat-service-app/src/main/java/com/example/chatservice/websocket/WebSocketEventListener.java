package com.example.chatservice.websocket;

import com.example.chatservice.Model.User;
import com.example.chatservice.service.ChatRoomService;
import com.example.chatservice.service.UserService;

import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.util.Map;

@Component
public class WebSocketEventListener {

    private final UserService userService;
    private final ChatRoomService chatRoomService;
    private final SimpMessagingTemplate messagingTemplate;

    public WebSocketEventListener(UserService userService,
                                  ChatRoomService chatRoomService,
                                  SimpMessagingTemplate messagingTemplate) {
        this.userService = userService;
        this.chatRoomService = chatRoomService;
        this.messagingTemplate = messagingTemplate;
    }

    @EventListener
    public void handleWebSocketConnect(SessionConnectEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        if (accessor.getUser() != null) {
            String username = accessor.getUser().getName();
            userService.findByUsername(username).ifPresent(user -> {
                userService.updateUserStatus(user.getId(), User.UserStatus.ONLINE);
                broadcastStatusToRooms(user, User.UserStatus.ONLINE);
            });
        }
    }

    @EventListener
    public void handleWebSocketDisconnect(SessionDisconnectEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        if (accessor.getUser() != null) {
            String username = accessor.getUser().getName();
            userService.findByUsername(username).ifPresent(user -> {
                userService.updateUserStatus(user.getId(), User.UserStatus.OFFLINE);
                broadcastStatusToRooms(user, User.UserStatus.OFFLINE);
            });
        }
    }

    private void broadcastStatusToRooms(User user, User.UserStatus status) {
        // Only broadcast if user has showOnlineStatus enabled
        String broadcastStatus = user.isShowOnlineStatus() ? status.toString() : "OFFLINE";

        chatRoomService.listMembershipsForUser(user.getId()).forEach(membership -> {
            Map<String, Object> statusEvent = Map.of(
                    "type", "STATUS_UPDATE",
                    "roomId", membership.getRoom().getId(),
                    "user", Map.of(
                            "username", user.getUsername(),
                            "displayName", user.getDisplayName(),
                            "status", broadcastStatus),
                    "timestamp", System.currentTimeMillis());
            messagingTemplate.convertAndSend(
                    "/topic/rooms/" + membership.getRoom().getId() + "/events",
                    statusEvent);
        });
    }
}
