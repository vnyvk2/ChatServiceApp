// Enhanced ChatMessagingController.java
package com.example.chatservice.websocket;

import com.example.chatservice.domain.User;
import com.example.chatservice.repository.UserRepository;
import com.example.chatservice.service.ChatRoomService;
import com.example.chatservice.service.MessageService;
import com.example.chatservice.service.UserService;
import jakarta.validation.constraints.NotBlank;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Controller;

import java.util.Map;

@Controller
public class ChatMessagingController {

    private final MessageService messageService;
    private final ChatRoomService chatRoomService;
    private final UserService userService;
    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;

    public ChatMessagingController(MessageService messageService,
                                   ChatRoomService chatRoomService,
                                   UserService userService,
                                   UserRepository userRepository,
                                   SimpMessagingTemplate messagingTemplate) {
        this.messageService = messageService;
        this.chatRoomService = chatRoomService;
        this.userService = userService;
        this.userRepository = userRepository;
        this.messagingTemplate = messagingTemplate;
    }

    @MessageMapping("/rooms/{roomId}/send")
    public void sendToRoom(@DestinationVariable Long roomId,
                           @Payload MessagePayload payload,
                           Authentication authentication) {
        String username = authentication.getName();
        User sender = userRepository.findByUsername(username).orElseThrow();

        messageService.saveEncrypted(roomId, username, payload.text());

        Map<String, Object> messageEvent = Map.of(
                "type", "MESSAGE",
                "roomId", roomId,
                "sender", Map.of(
                        "username", username,
                        "displayName", sender.getDisplayName(),
                        "status", sender.getStatus().toString()
                ),
                "text", payload.text(),
                "timestamp", System.currentTimeMillis()
        );
        messagingTemplate.convertAndSend("/topic/rooms/" + roomId, messageEvent);
    }

    @MessageMapping("/user/status")
    public void updateStatus(@Payload StatusPayload payload, Authentication authentication) {
        String username = authentication.getName();
        User user = userRepository.findByUsername(username).orElseThrow();

        try {
            User.UserStatus newStatus = User.UserStatus.valueOf(payload.status().toUpperCase());
            userService.updateUserStatus(user.getId(), newStatus);

            // Broadcast status change to all rooms the user is in
            chatRoomService.listMembershipsForUser(user.getId()).forEach(membership -> {
                Map<String, Object> statusEvent = Map.of(
                        "type", "STATUS_UPDATE",
                        "roomId", membership.getRoom().getId(),
                        "user", Map.of(
                                "username", username,
                                "displayName", user.getDisplayName(),
                                "status", newStatus.toString()
                        ),
                        "timestamp", System.currentTimeMillis()
                );
                messagingTemplate.convertAndSend("/topic/rooms/" + membership.getRoom().getId() + "/events", statusEvent);
            });
        } catch (IllegalArgumentException e) {
            // Invalid status provided
            Map<String, Object> errorEvent = Map.of(
                    "type", "ERROR",
                    "message", "Invalid status: " + payload.status(),
                    "timestamp", System.currentTimeMillis()
            );
            messagingTemplate.convertAndSendToUser(username, "/queue/errors", errorEvent);
        }
    }

    @MessageMapping("/rooms/{roomId}/typing")
    public void userTyping(@DestinationVariable Long roomId,
                           @Payload TypingPayload payload,
                           Authentication authentication) {
        String username = authentication.getName();
        User user = userRepository.findByUsername(username).orElseThrow();

        Map<String, Object> typingEvent = Map.of(
                "type", "TYPING",
                "roomId", roomId,
                "user", Map.of(
                        "username", username,
                        "displayName", user.getDisplayName()
                ),
                "isTyping", payload.isTyping(),
                "timestamp", System.currentTimeMillis()
        );

        // Send typing indicator to all room members except the sender
        messagingTemplate.convertAndSend("/topic/rooms/" + roomId + "/typing", typingEvent);
    }

    @MessageMapping("/rooms/{roomId}/join-notification")
    public void handleJoinNotification(@DestinationVariable Long roomId,
                                       Authentication authentication) {
        String username = authentication.getName();
        User user = userRepository.findByUsername(username).orElseThrow();

        Map<String, Object> joinEvent = Map.of(
                "type", "USER_JOINED",
                "roomId", roomId,
                "user", Map.of(
                        "username", username,
                        "displayName", user.getDisplayName(),
                        "status", user.getStatus().toString()
                ),
                "message", user.getDisplayName() + " joined the room",
                "timestamp", System.currentTimeMillis()
        );
        messagingTemplate.convertAndSend("/topic/rooms/" + roomId + "/events", joinEvent);
    }

    @MessageMapping("/rooms/{roomId}/leave-notification")
    public void handleLeaveNotification(@DestinationVariable Long roomId,
                                        Authentication authentication) {
        String username = authentication.getName();
        User user = userRepository.findByUsername(username).orElseThrow();

        Map<String, Object> leaveEvent = Map.of(
                "type", "USER_LEFT",
                "roomId", roomId,
                "user", Map.of(
                        "username", username,
                        "displayName", user.getDisplayName()
                ),
                "message", user.getDisplayName() + " left the room",
                "timestamp", System.currentTimeMillis()
        );
        messagingTemplate.convertAndSend("/topic/rooms/" + roomId + "/events", leaveEvent);
    }

    // Payload record classes
    public record MessagePayload(@NotBlank String text) {}
    public record StatusPayload(@NotBlank String status) {}
    public record TypingPayload(boolean isTyping) {}
}