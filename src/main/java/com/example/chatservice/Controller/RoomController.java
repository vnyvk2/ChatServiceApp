package com.example.chatservice.Controller;

import com.example.chatservice.Dto.request.CreateRoomRequest;
import com.example.chatservice.Dto.request.CreateRoomWithOptionsRequest;
import com.example.chatservice.Dto.request.DirectMessageRequest;
import com.example.chatservice.Dto.request.JoinRoomRequest;
import com.example.chatservice.Dto.request.RenameRoomRequest;
import com.example.chatservice.Model.ChatRoom;
import com.example.chatservice.Model.RoomMembership;
import com.example.chatservice.Model.User;
import com.example.chatservice.service.ChatRoomService;
import com.example.chatservice.service.MessageService;
import com.example.chatservice.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/rooms")
@CrossOrigin(origins = "*")
@Tag(name = "Chat Room Management", description = "Endpoints for creating, joining, leaving, and managing chat rooms and direct messages")
public class RoomController {

    private final ChatRoomService chatRoomService;
    private final UserService userService;
    private final MessageService messageService;

    public RoomController(ChatRoomService chatRoomService,
            UserService userService,
            MessageService messageService) {
        this.chatRoomService = chatRoomService;
        this.userService = userService;
        this.messageService = messageService;
    }

    @PostMapping
    @Operation(summary = "Create a new room", description = "Creates a new public or private chat room.")
    public ResponseEntity<?> createRoom(@AuthenticationPrincipal UserDetails principal,
            @Valid @RequestBody CreateRoomRequest request) {
        if (principal == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }

        User creator = userService.resolveUserByUsername(principal.getUsername());

        ChatRoom.RoomType roomType;
        try {
            roomType = request.roomType() != null
                    ? ChatRoom.RoomType.valueOf(request.roomType().toUpperCase())
                    : ChatRoom.RoomType.GROUP_CHAT;
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid room type"));
        }

        ChatRoom room = chatRoomService.createRoom(
                request.name().trim(),
                request.description() != null ? request.description().trim() : "",
                roomType,
                request.isPrivate(),
                creator,
                request.password());

        Map<String, Object> response = new HashMap<>();
        response.put("id", room.getId());
        response.put("name", room.getName());
        response.put("description", room.getDescription() != null ? room.getDescription() : "");
        response.put("roomType", room.getRoomType().name());
        response.put("isPrivate", room.isPrivate());
        response.put("memberCount", chatRoomService.getRoomMemberCount(room.getId()));
        if (room.getInviteToken() != null) {
            response.put("inviteToken", room.getInviteToken());
        }

        return ResponseEntity.status(201).body(response);
    }

    @PostMapping("/{roomId}/join")
    @Operation(summary = "Join a room", description = "Adds the current user to a specific chat room. For private rooms, a password is required.")
    public ResponseEntity<?> joinRoom(@PathVariable String roomId,
            @AuthenticationPrincipal UserDetails principal,
            @RequestBody(required = false) JoinRoomRequest request) {
        if (principal == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }
        try {
            User user = userService.resolveUserByUsername(principal.getUsername());
            ChatRoom room = chatRoomService.findRoomById(roomId)
                    .orElseThrow(() -> new RuntimeException("Room not found"));

            if (room.isPrivate()) {
                String password = request != null ? request.password() : null;
                if (password == null || password.trim().isEmpty()) {
                    return ResponseEntity.status(403).body(Map.of("error", "Password required for private rooms"));
                }
                chatRoomService.joinRoomWithPassword(roomId, password, user.getId());
            } else {
                chatRoomService.addMember(roomId, user.getId());
            }

            chatRoomService.broadcastUserJoined(roomId, user);
            return ResponseEntity.ok(Map.of("message", "Successfully joined the room"));
        } catch (RuntimeException e) {
            return ResponseEntity.status(403).body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/{roomId}/leave")
    @Operation(summary = "Leave a room", description = "Removes the current user from a specific chat room and broadcasts a leave event.")
    public ResponseEntity<?> leaveRoom(@PathVariable String roomId,
            @AuthenticationPrincipal UserDetails principal) {
        if (principal == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }
        User user = userService.resolveUserByUsername(principal.getUsername());
        chatRoomService.removeMember(roomId, user.getId());
        chatRoomService.broadcastUserLeft(roomId, user);
        return ResponseEntity.ok(Map.of("message", "Successfully left the room"));
    }

    @GetMapping("/available")
    @Operation(summary = "Get available public rooms", description = "Lists all public chat rooms that users can join.")
    public ResponseEntity<?> getAvailableRooms() {
        List<ChatRoom> rooms = chatRoomService.listPublicRooms();
        List<Map<String, Object>> result = rooms.stream().map(room -> {
            Map<String, Object> data = new HashMap<>();
            data.put("id", room.getId());
            data.put("name", room.getName());
            data.put("description", room.getDescription() != null ? room.getDescription() : "");
            data.put("roomType", room.getRoomType().name());
            data.put("isPrivate", room.isPrivate());
            data.put("memberCount", chatRoomService.getRoomMemberCount(room.getId()));
            return data;
        }).toList();
        return ResponseEntity.ok(result);
    }

    @GetMapping("/search")
    @Operation(summary = "Search public rooms", description = "Searches public rooms by name. Returns only public GROUP_CHAT rooms.")
    public ResponseEntity<?> searchPublicRooms(@RequestParam(defaultValue = "") String query) {
        List<ChatRoom> rooms = chatRoomService.searchPublicRooms(query);
        List<Map<String, Object>> result = rooms.stream().map(room -> {
            Map<String, Object> data = new HashMap<>();
            data.put("id", room.getId());
            data.put("name", room.getName());
            data.put("description", room.getDescription() != null ? room.getDescription() : "");
            data.put("roomType", room.getRoomType().name());
            data.put("isPrivate", false);
            data.put("memberCount", chatRoomService.getRoomMemberCount(room.getId()));
            return data;
        }).toList();
        return ResponseEntity.ok(result);
    }

    @PostMapping("/join-by-token")
    @Operation(summary = "Join room by invite token", description = "Joins a private room using an invite link token.")
    public ResponseEntity<?> joinRoomByToken(@RequestParam String token,
            @AuthenticationPrincipal UserDetails principal) {
        if (principal == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }
        try {
            User user = userService.resolveUserByUsername(principal.getUsername());
            RoomMembership membership = chatRoomService.joinRoomByInviteToken(token, user.getId());
            ChatRoom room = membership.getRoom();

            chatRoomService.broadcastUserJoined(room.getId(), user);

            Map<String, Object> response = new HashMap<>();
            response.put("message", "Successfully joined the room");
            response.put("roomId", room.getId());
            response.put("roomName", room.getName());
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            return ResponseEntity.status(403).body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/{roomId}/invite-token")
    @Operation(summary = "Get invite token", description = "Returns the invite token for a private room. Admin only.")
    public ResponseEntity<?> getInviteToken(@PathVariable String roomId,
            @AuthenticationPrincipal UserDetails principal) {
        if (principal == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }
        try {
            User user = userService.resolveUserByUsername(principal.getUsername());
            String inviteToken = chatRoomService.getInviteToken(roomId, user.getId());
            return ResponseEntity.ok(Map.of("inviteToken", inviteToken != null ? inviteToken : ""));
        } catch (RuntimeException e) {
            return ResponseEntity.status(403).body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/{roomId}/regenerate-token")
    @Operation(summary = "Regenerate invite token", description = "Generates a new invite token, invalidating the old one. Admin only.")
    public ResponseEntity<?> regenerateInviteToken(@PathVariable String roomId,
            @AuthenticationPrincipal UserDetails principal) {
        if (principal == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }
        try {
            User user = userService.resolveUserByUsername(principal.getUsername());
            String newToken = chatRoomService.regenerateInviteToken(roomId, user.getId());
            return ResponseEntity.ok(Map.of("inviteToken", newToken, "message", "Invite token regenerated"));
        } catch (RuntimeException e) {
            return ResponseEntity.status(403).body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/my-rooms")
    @Operation(summary = "Get my rooms", description = "Lists all chat rooms the current user is a member of.")
    public ResponseEntity<?> getMyRooms(@AuthenticationPrincipal UserDetails principal) {
        if (principal == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }
        try {
            User user = userService.resolveUserByUsername(principal.getUsername());
            List<RoomMembership> memberships = chatRoomService.listMembershipsForUser(user.getId());

            List<Map<String, Object>> result = memberships.stream().map(membership -> {
                ChatRoom room = membership.getRoom();
                Map<String, Object> roomData = new HashMap<>();
                roomData.put("id", room.getId());
                String displayName = room.getName();
                if (room.getRoomType() == ChatRoom.RoomType.DIRECT_MESSAGE) {
                    List<RoomMembership> roomMembers = chatRoomService.getRoomMembers(room.getId());
                    User otherUser = roomMembers.stream()
                            .map(RoomMembership::getUser)
                            .filter(u -> !u.getId().equals(user.getId()))
                            .findFirst()
                            .orElse(null);
                    if (otherUser != null) {
                        displayName = otherUser.getPhoneNumber() != null ? otherUser.getPhoneNumber() : otherUser.getUsername();
                    }
                }

                roomData.put("name", displayName);
                roomData.put("description", room.getDescription() != null ? room.getDescription() : "");
                roomData.put("roomType", room.getRoomType().name());
                roomData.put("isPrivate", room.isPrivate());

                List<com.example.chatservice.Model.Message> recentMessages = messageService.getRecentMessages(room.getId(), user.getId(), 1);
                if (!recentMessages.isEmpty()) {
                    com.example.chatservice.Model.Message lastMsg = recentMessages.get(0);
                    String decryptedText = messageService.decrypt(lastMsg.getEncryptedContent());
                    Map<String, Object> lastMessageData = new HashMap<>();
                    lastMessageData.put("text", decryptedText);
                    lastMessageData.put("createdAt", lastMsg.getCreatedAt());
                    lastMessageData.put("senderName", lastMsg.getSender().getDisplayName());
                    roomData.put("lastMessage", lastMessageData);
                }

                Map<String, Object> membershipData = new HashMap<>();
                membershipData.put("room", roomData);
                membershipData.put("role", membership.getRole().name());
                membershipData.put("joinedAt",
                        membership.getJoinedAt() != null ? membership.getJoinedAt().toString() : null);

                return membershipData;
            }).toList();

            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "Failed to load your rooms"));
        }
    }

    @PostMapping("/direct-message")
    @Operation(summary = "Create or get DM room", description = "Creates a new direct message room or retrieves an existing one between the current user and target user.")
    public ResponseEntity<?> createDirectMessage(@AuthenticationPrincipal UserDetails principal,
            @Valid @RequestBody DirectMessageRequest request) {
        if (principal == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }

        if (request == null || !request.isValid()) {
            return ResponseEntity.badRequest().body(Map.of("error", "phoneNumber or username is required"));
        }

        User currentUser = userService.resolveUserByUsername(principal.getUsername());
        User targetUser = null;
        if (request.phoneNumber() != null && !request.phoneNumber().trim().isEmpty()) {
            targetUser = userService.findByPhoneNumber(request.phoneNumber()).orElse(null);
        }
        if (targetUser == null && request.username() != null && !request.username().trim().isEmpty()) {
            targetUser = userService.findByUsername(request.username()).orElse(null);
        }

        if (targetUser == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "User not found"));
        }

        ChatRoom dmRoom = chatRoomService.createDirectMessage(currentUser, targetUser);
        Map<String, Object> response = new HashMap<>();
        response.put("id", dmRoom.getId());
        response.put("name", targetUser.getPhoneNumber() != null ? targetUser.getPhoneNumber() : targetUser.getUsername());
        response.put("roomType", dmRoom.getRoomType().name());
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{roomId}/members")
    @Operation(summary = "Get room members", description = "Retrieves a list of all members in a specific chat room.")
    public ResponseEntity<?> getRoomMembers(@PathVariable String roomId,
            @AuthenticationPrincipal UserDetails principal) {
        List<RoomMembership> members = chatRoomService.getRoomMembers(roomId);
        if (members == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Room not found"));
        }

        ChatRoom room = chatRoomService.findRoomById(roomId).orElse(null);
        boolean roomMuted = room != null && room.isAllMembersMuted();

        // Get requesting user for privacy filtering
        User requestingUser = null;
        if (principal != null) {
            requestingUser = userService.findByUsername(principal.getUsername()).orElse(null);
        }
        final boolean requesterLastSeenVisible = requestingUser != null && requestingUser.isLastSeenVisible();

        return ResponseEntity.ok(Map.of(
            "allMembersMuted", roomMuted,
            "members", members.stream().map(membership -> {
                User memberUser = membership.getUser();
                String effectiveStatus = memberUser.isShowOnlineStatus()
                        ? memberUser.getStatus().toString()
                        : "OFFLINE";
                Object effectiveLastSeen = "";
                if (memberUser.isLastSeenVisible() && requesterLastSeenVisible
                        && memberUser.getLastSeenAt() != null) {
                    effectiveLastSeen = memberUser.getLastSeenAt();
                }

                return Map.of(
                    "id", membership.getUser().getId(),
                    "username", membership.getUser().getUsername(),
                    "displayName", membership.getUser().getDisplayName(),
                    "status", effectiveStatus,
                    "phoneNumber", membership.getUser().getPhoneNumber() != null ? membership.getUser().getPhoneNumber() : "",
                    "lastSeenAt", effectiveLastSeen,
                    "role", membership.getRole(),
                    "canSendMessages", membership.isCanSendMessages(),
                    "joinedAt", membership.getJoinedAt());
            }).toList()
        ));
    }

    // --- Admin Endpoints ---

    @PutMapping("/{roomId}/members/{userId}/remove")
    @Operation(summary = "Remove a member", description = "Allows an admin to remove a member from the room.")
    public ResponseEntity<?> removeMember(@PathVariable String roomId, @PathVariable String userId,
            @AuthenticationPrincipal UserDetails principal) {
        if (principal == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }
        try {
            User admin = userService.resolveUserByUsername(principal.getUsername());
            chatRoomService.removeMemberAsAdmin(roomId, userId, admin.getId());

            User kickedUser = userService.findById(userId)
                    .orElseThrow(() -> new RuntimeException("User not found"));
            chatRoomService.broadcastUserKicked(roomId, admin, kickedUser);

            return ResponseEntity.ok(Map.of("message", "Member removed successfully"));
        } catch (Exception e) {
            return ResponseEntity.status(403).body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/{roomId}/members/{userId}/mute")
    @Operation(summary = "Mute/Unmute a member", description = "Allows an admin to toggle a member's ability to send messages.")
    public ResponseEntity<?> toggleMemberMute(@PathVariable String roomId, @PathVariable String userId,
            @AuthenticationPrincipal UserDetails principal) {
        if (principal == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }
        try {
            User admin = userService.resolveUserByUsername(principal.getUsername());
            RoomMembership updated = chatRoomService.toggleMemberMute(roomId, userId, admin.getId());
            return ResponseEntity.ok(Map.of("message", "Member mute status toggled", "canSendMessages", updated.isCanSendMessages()));
        } catch (Exception e) {
            return ResponseEntity.status(403).body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/{roomId}/members/{userId}/admin")
    @Operation(summary = "Promote/Demote admin", description = "Allows an admin to promote or demote another member.")
    public ResponseEntity<?> toggleAdminRole(@PathVariable String roomId, @PathVariable String userId,
            @AuthenticationPrincipal UserDetails principal) {
        if (principal == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }
        try {
            User admin = userService.resolveUserByUsername(principal.getUsername());
            RoomMembership updated = chatRoomService.toggleAdminRole(roomId, userId, admin.getId());
            return ResponseEntity.ok(Map.of("message", "Admin role toggled", "role", updated.getRole()));
        } catch (Exception e) {
            return ResponseEntity.status(403).body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/{roomId}/mute")
    @Operation(summary = "Mute/Unmute room", description = "Allows an admin to restrict messaging to admins only.")
    public ResponseEntity<?> toggleRoomMute(@PathVariable String roomId,
            @AuthenticationPrincipal UserDetails principal) {
        if (principal == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }
        try {
            User admin = userService.resolveUserByUsername(principal.getUsername());
            ChatRoom updated = chatRoomService.toggleRoomMute(roomId, admin.getId());
            chatRoomService.broadcastRoomMuteToggled(roomId, admin, updated.isAllMembersMuted());
            return ResponseEntity.ok(Map.of("message", "Room mute toggled", "allMembersMuted", updated.isAllMembersMuted()));
        } catch (Exception e) {
            return ResponseEntity.status(403).body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/create-with-options")
    @Operation(summary = "Create room with extended options", description = "Creates a room with custom descriptions and initial members.")
    public ResponseEntity<?> createRoomWithOptions(@AuthenticationPrincipal UserDetails principal,
            @Valid @RequestBody CreateRoomWithOptionsRequest request) {
        if (principal == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }
        User creator = userService.resolveUserByUsername(principal.getUsername());

        if (!request.isPrivate()) {
            if (chatRoomService.findRoomByName(request.name()).isPresent()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Room name already exists"));
            }
        }

        ChatRoom room = chatRoomService.createRoom(
                request.name(),
                request.description(),
                ChatRoom.RoomType.GROUP_CHAT,
                request.isPrivate(),
                creator,
                request.password());

        if (request.isPrivate() && request.initialMembers() != null) {
            for (String memberIdentifier : request.initialMembers()) {
                User member = userService.findByUsername(memberIdentifier)
                        .orElse(userService.findByPhoneNumber(memberIdentifier).orElse(null));
                if (member != null) {
                    chatRoomService.addMember(room.getId(), member.getId(), true);
                }
            }
        }

        Map<String, Object> response = new HashMap<>();
        response.put("id", room.getId());
        response.put("name", room.getName());
        response.put("description", room.getDescription());
        response.put("roomType", room.getRoomType());
        response.put("isPrivate", room.isPrivate());
        response.put("memberCount", chatRoomService.getRoomMemberCount(room.getId()));
        if (room.getInviteToken() != null) {
            response.put("inviteToken", room.getInviteToken());
        }
        return ResponseEntity.ok(response);
    }

    @PutMapping("/{roomId}/rename")
    @Operation(summary = "Rename a room", description = "Updates the name of a group chat room or a direct message room.")
    public ResponseEntity<?> renameRoom(@PathVariable String roomId,
            @AuthenticationPrincipal UserDetails principal,
            @RequestBody RenameRoomRequest request) {
        if (principal == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }
        User user = userService.resolveUserByUsername(principal.getUsername());

        if (!chatRoomService.isUserRoomAdmin(user.getId(), roomId) &&
                !chatRoomService.findRoomById(roomId).map(r -> r.getCreatedBy().getId().equals(user.getId()))
                        .orElse(false)) {
            ChatRoom room = chatRoomService.findRoomById(roomId).orElse(null);
            if (room != null && room.getRoomType() == ChatRoom.RoomType.DIRECT_MESSAGE) {
                if (!chatRoomService.isUserMemberOfRoom(user.getId(), roomId)) {
                    return ResponseEntity.status(403).body(Map.of("error", "Not a member of this chat"));
                }
            } else {
                return ResponseEntity.status(403).body(Map.of("error", "Only admins can rename group rooms"));
            }
        }

        ChatRoom updatedRoom = chatRoomService.updateRoom(roomId, request.name(), null,
                chatRoomService.findRoomById(roomId).get().isPrivate());
        return ResponseEntity.ok(Map.of(
                "id", updatedRoom.getId(),
                "name", updatedRoom.getName(),
                "message", "Room renamed successfully"));
    }

    @DeleteMapping("/{roomId}")
    @Operation(summary = "Delete a room", description = "Deletes a room and all its messages. Only the creator can delete; if creator left, any admin can.")
    public ResponseEntity<?> deleteRoom(@PathVariable String roomId,
            @AuthenticationPrincipal UserDetails principal) {
        if (principal == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }
        try {
            User user = userService.resolveUserByUsername(principal.getUsername());
            ChatRoom room = chatRoomService.findRoomById(roomId)
                    .orElseThrow(() -> new RuntimeException("Room not found"));

            boolean isCreator = room.getCreatedBy() != null && room.getCreatedBy().getId().equals(user.getId());
            boolean creatorIsActive = room.getCreatedBy() != null
                    && chatRoomService.isUserActiveMemberOfRoom(room.getCreatedBy().getId(), roomId);
            boolean isAdmin = chatRoomService.isUserRoomAdmin(user.getId(), roomId);

            if (!isCreator && !(isAdmin && !creatorIsActive)) {
                return ResponseEntity.status(403).body(Map.of("error", "Only the room creator can delete this room"));
            }

            messageService.deleteAllMessagesInRoom(roomId);
            chatRoomService.deleteRoom(roomId);
            chatRoomService.broadcastRoomDeleted(roomId, user);

            return ResponseEntity.ok(Map.of("message", "Room deleted successfully"));
        } catch (RuntimeException e) {
            return ResponseEntity.status(403).body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/{roomId}/messages")
    @Operation(summary = "Clear all messages", description = "Deletes all messages in a room. Admin only.")
    public ResponseEntity<?> clearRoomMessages(@PathVariable String roomId,
            @AuthenticationPrincipal UserDetails principal) {
        if (principal == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }
        try {
            User user = userService.resolveUserByUsername(principal.getUsername());
            if (!chatRoomService.isUserRoomAdmin(user.getId(), roomId)) {
                return ResponseEntity.status(403).body(Map.of("error", "Only admins can clear messages"));
            }

            messageService.deleteAllMessagesInRoom(roomId);
            chatRoomService.broadcastMessagesCleared(roomId, user);

            return ResponseEntity.ok(Map.of("message", "All messages cleared"));
        } catch (RuntimeException e) {
            return ResponseEntity.status(403).body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/{roomId}/messages/{messageId}")
    @Operation(summary = "Delete a specific message", description = "Deletes a specific message. Admin can delete any message. Sender can delete their own message.")
    public ResponseEntity<?> deleteMessage(@PathVariable String roomId,
            @PathVariable String messageId,
            @RequestParam(defaultValue = "false") boolean forEveryone,
            @AuthenticationPrincipal UserDetails principal) {
        if (principal == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }
        try {
            User user = userService.resolveUserByUsername(principal.getUsername());
            com.example.chatservice.Model.Message message = messageService.findById(messageId)
                    .orElseThrow(() -> new RuntimeException("Message not found"));

            boolean isAdmin = chatRoomService.isUserRoomAdmin(user.getId(), roomId);
            boolean isSender = message.getSender().getId().equals(user.getId());

            if (!forEveryone) {
                messageService.deleteMessageForMe(messageId, user.getId());
                return ResponseEntity.ok(Map.of("message", "Message deleted for you"));
            }

            if (!isAdmin && !isSender) {
                return ResponseEntity.status(403).body(Map.of("error", "Only admins or the sender can delete messages for everyone"));
            }

            if (isSender && !isAdmin) {
                if (java.time.Instant.now().isAfter(message.getCreatedAt().plusSeconds(300))) {
                    return ResponseEntity.status(403).body(Map.of("error", "Messages can only be deleted for everyone within 5 minutes of sending"));
                }
            }

            messageService.deleteMessage(messageId);
            chatRoomService.broadcastMessageDeleted(roomId, messageId);

            return ResponseEntity.ok(Map.of("message", "Message deleted"));
        } catch (RuntimeException e) {
            return ResponseEntity.status(403).body(Map.of("error", e.getMessage()));
        }
    }
}