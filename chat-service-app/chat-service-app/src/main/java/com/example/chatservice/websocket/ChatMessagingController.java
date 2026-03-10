package com.example.chatservice.websocket;

import com.example.chatservice.Model.Message;
import com.example.chatservice.Model.User;
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

import java.util.HashMap;
import java.util.List;
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
        public void sendToRoom(@DestinationVariable String roomId,
                        @Payload MessagePayload payload,
                        Authentication authentication) {
                System.out.println("📩 Message received for room: " + roomId);
                if (authentication == null) {
                        System.err.println("❌ Authentication is NULL in sendToRoom!");
                        return;
                }

                try {
                        String username = authentication.getName();
                        System.out.println("👤 Sender: " + username);
                        System.out.println("📝 Payload: " + payload.text());

                        User sender = userRepository.findByUsername(username)
                                        .orElseThrow(() -> new RuntimeException("User not found: " + username));

                        // Enforce messaging restrictions
                        var membershipOpt = chatRoomService.getMembership(sender.getId(), roomId);
                        if (membershipOpt.isPresent()) {
                            var membership = membershipOpt.get();
                            var room = membership.getRoom();
                            
                            if (!membership.isCanSendMessages()) {
                                throw new RuntimeException("You have been muted in this room.");
                            }
                            
                            if (room.isAllMembersMuted() && membership.getRole() != com.example.chatservice.Model.RoomMembership.Role.ADMIN) {
                                throw new RuntimeException("This room is currently restricted to announcements only.");
                            }
                        } else if (chatRoomService.findRoomById(roomId).map(r -> r.getRoomType() != com.example.chatservice.Model.ChatRoom.RoomType.GROUP_CHAT).orElse(false)) {
                            throw new RuntimeException("You are not a member of this room.");
                        }

                        System.out.println("🔄 Saving message to DB...");
                        Message savedMessage = messageService.saveEncrypted(roomId, username, payload.text());
                        System.out.println("✅ Message saved to database: " + savedMessage.getId());

                        Map<String, Object> messageEvent = new HashMap<>();
                        messageEvent.put("type", "MESSAGE");
                        messageEvent.put("id", savedMessage.getId());
                        messageEvent.put("roomId", roomId);
                        messageEvent.put("sender", Map.of(
                                        "username", username,
                                        "displayName", sender.getDisplayName(),
                                        "status", sender.getStatus().toString()));
                        messageEvent.put("text", payload.text());
                        messageEvent.put("messageStatus", savedMessage.getStatus().toString());
                        messageEvent.put("timestamp", System.currentTimeMillis());

                        System.out.println("📡 Broadcasting to /topic/rooms/" + roomId);
                        messagingTemplate.convertAndSend("/topic/rooms/" + roomId, messageEvent);
                        System.out.println("✅ Message broadcasted successfully");
                } catch (Exception e) {
                        System.err.println("❌ Error in sendToRoom: " + e.getMessage());
                        e.printStackTrace();
                        if (authentication != null) {
                                Map<String, Object> errorEvent = Map.of(
                                                "type", "ERROR",
                                                "message", "Failed to send message: " + e.getMessage(),
                                                "timestamp", System.currentTimeMillis());
                                messagingTemplate.convertAndSendToUser(authentication.getName(), "/queue/errors",
                                                errorEvent);
                        }
                }
        }

        @MessageMapping("/rooms/{roomId}/delivered")
        public void markDelivered(@DestinationVariable String roomId,
                        Authentication authentication) {
                if (authentication == null) return;

                try {
                        String username = authentication.getName();
                        User user = userRepository.findByUsername(username).orElseThrow();

                        List<String> updatedIds = messageService.markAsDelivered(roomId, user.getId());

                        if (!updatedIds.isEmpty()) {
                                Map<String, Object> statusEvent = new HashMap<>();
                                statusEvent.put("type", "MESSAGE_STATUS_UPDATE");
                                statusEvent.put("roomId", roomId);
                                statusEvent.put("messageIds", updatedIds);
                                statusEvent.put("newStatus", "DELIVERED");
                                statusEvent.put("timestamp", System.currentTimeMillis());

                                messagingTemplate.convertAndSend("/topic/rooms/" + roomId + "/status", statusEvent);
                        }
                } catch (Exception e) {
                        System.err.println("❌ Error in markDelivered: " + e.getMessage());
                }
        }

        @MessageMapping("/rooms/{roomId}/seen")
        public void markSeen(@DestinationVariable String roomId,
                        Authentication authentication) {
                if (authentication == null) return;

                try {
                        String username = authentication.getName();
                        User user = userRepository.findByUsername(username).orElseThrow();

                        // Check if user has read receipts enabled
                        if (!user.isReadReceiptsEnabled()) {
                                return;
                        }

                        List<String> updatedIds = messageService.markAsSeen(roomId, user.getId());

                        if (!updatedIds.isEmpty()) {
                                Map<String, Object> statusEvent = new HashMap<>();
                                statusEvent.put("type", "MESSAGE_STATUS_UPDATE");
                                statusEvent.put("roomId", roomId);
                                statusEvent.put("messageIds", updatedIds);
                                statusEvent.put("newStatus", "SEEN");
                                statusEvent.put("timestamp", System.currentTimeMillis());

                                messagingTemplate.convertAndSend("/topic/rooms/" + roomId + "/status", statusEvent);
                        }
                } catch (Exception e) {
                        System.err.println("❌ Error in markSeen: " + e.getMessage());
                }
        }

        @MessageMapping("/user/status")
        public void updateStatus(@Payload StatusPayload payload, Authentication authentication) {
                if (authentication == null) return;
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
                                                                "status", newStatus.toString()),
                                                "timestamp", System.currentTimeMillis());
                                messagingTemplate.convertAndSend(
                                                "/topic/rooms/" + membership.getRoom().getId() + "/events",
                                                statusEvent);
                        });
                } catch (IllegalArgumentException e) {
                        Map<String, Object> errorEvent = Map.of(
                                        "type", "ERROR",
                                        "message", "Invalid status: " + payload.status(),
                                        "timestamp", System.currentTimeMillis());
                        messagingTemplate.convertAndSendToUser(username, "/queue/errors", errorEvent);
                }
        }

        @MessageMapping("/rooms/{roomId}/typing")
        public void userTyping(@DestinationVariable String roomId,
                        @Payload TypingPayload payload,
                        Authentication authentication) {
                if (authentication == null) return;
                String username = authentication.getName();
                User user = userRepository.findByUsername(username).orElseThrow();

                Map<String, Object> typingEvent = Map.of(
                                "type", "TYPING",
                                "roomId", roomId,
                                "user", Map.of(
                                                "username", username,
                                                "displayName", user.getDisplayName()),
                                "isTyping", payload.isTyping(),
                                "timestamp", System.currentTimeMillis());

                messagingTemplate.convertAndSend("/topic/rooms/" + roomId + "/typing", typingEvent);
        }

        @MessageMapping("/rooms/{roomId}/join-notification")
        public void handleJoinNotification(@DestinationVariable String roomId,
                        Authentication authentication) {
                if (authentication == null) return;
                String username = authentication.getName();
                User user = userRepository.findByUsername(username).orElseThrow();

                Map<String, Object> joinEvent = Map.of(
                                "type", "USER_JOINED",
                                "roomId", roomId,
                                "user", Map.of(
                                                "username", username,
                                                "displayName", user.getDisplayName(),
                                                "status", user.getStatus().toString()),
                                "message", user.getDisplayName() + " joined the room",
                                "timestamp", System.currentTimeMillis());
                messagingTemplate.convertAndSend("/topic/rooms/" + roomId + "/events", joinEvent);
        }

        @MessageMapping("/rooms/{roomId}/leave-notification")
        public void handleLeaveNotification(@DestinationVariable String roomId,
                        Authentication authentication) {
                if (authentication == null) return;
                String username = authentication.getName();
                User user = userRepository.findByUsername(username).orElseThrow();

                Map<String, Object> leaveEvent = Map.of(
                                "type", "USER_LEFT",
                                "roomId", roomId,
                                "user", Map.of(
                                                "username", username,
                                                "displayName", user.getDisplayName()),
                                "message", user.getDisplayName() + " left the room",
                                "timestamp", System.currentTimeMillis());
                messagingTemplate.convertAndSend("/topic/rooms/" + roomId + "/events", leaveEvent);
        }

        // Payload record classes
        public record MessagePayload(@NotBlank String text) {
        }

        public record StatusPayload(@NotBlank String status) {
        }

        public record TypingPayload(boolean isTyping) {
        }
}