// Updated RoomController.java
package com.example.chatservice.web;

import com.example.chatservice.domain.ChatRoom;
import com.example.chatservice.domain.RoomMembership;
import com.example.chatservice.domain.User;
import com.example.chatservice.repository.UserRepository;
import com.example.chatservice.service.ChatRoomService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/rooms")
@CrossOrigin(origins = "*")
public class RoomController {

    private final ChatRoomService chatRoomService;
    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;

    public RoomController(ChatRoomService chatRoomService,
            UserRepository userRepository,
            SimpMessagingTemplate messagingTemplate) {
        this.chatRoomService = chatRoomService;
        this.userRepository = userRepository;
        this.messagingTemplate = messagingTemplate;
    }

    @PostMapping
    public ResponseEntity<?> createRoom(@AuthenticationPrincipal UserDetails principal,
            @Valid @RequestBody CreateRoomRequest request) {
        if (principal == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }

        User creator = userRepository.findByUsername(principal.getUsername())
                .orElseThrow(() -> new RuntimeException("User not found"));

        // Handle null/invalid roomType gracefully
        ChatRoom.RoomType roomType;
        try {
            roomType = request.roomType() != null
                    ? ChatRoom.RoomType.valueOf(request.roomType().toUpperCase())
                    : ChatRoom.RoomType.GROUP_CHAT; // default
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid room type"));
        }

        ChatRoom room = chatRoomService.createRoom(
                request.name().trim(),
                request.description() != null ? request.description().trim() : "",
                roomType,
                request.isPrivate(),
                creator);

        Map<String, Object> response = new java.util.HashMap<>();
        response.put("id", room.getId());
        response.put("name", room.getName());
        response.put("description", room.getDescription() != null ? room.getDescription() : "");
        response.put("roomType", room.getRoomType().name());
        response.put("isPrivate", room.isPrivate());
        response.put("memberCount", chatRoomService.getRoomMemberCount(room.getId()));

        return ResponseEntity.status(201).body(response);
    }

    @PostMapping("/{roomId}/join")
    public ResponseEntity<?> joinRoom(@PathVariable Long roomId,
            @AuthenticationPrincipal UserDetails principal) {
        User user = userRepository.findByUsername(principal.getUsername()).orElseThrow();
        chatRoomService.addMember(roomId, user.getId());

        // Broadcast join notification
        Map<String, Object> joinEvent = Map.of(
                "type", "USER_JOINED",
                "roomId", roomId,
                "user", Map.of(
                        "username", user.getUsername(),
                        "displayName", user.getDisplayName()),
                "message", user.getDisplayName() + " joined the room",
                "timestamp", System.currentTimeMillis());
        messagingTemplate.convertAndSend("/topic/rooms/" + roomId + "/events", joinEvent);

        return ResponseEntity.ok(Map.of("message", "Successfully joined the room"));
    }

    @PostMapping("/{roomId}/leave")
    public ResponseEntity<?> leaveRoom(@PathVariable Long roomId,
            @AuthenticationPrincipal UserDetails principal) {
        User user = userRepository.findByUsername(principal.getUsername()).orElseThrow();
        chatRoomService.removeMember(roomId, user.getId());

        // Broadcast leave notification
        Map<String, Object> leaveEvent = Map.of(
                "type", "USER_LEFT",
                "roomId", roomId,
                "user", Map.of(
                        "username", user.getUsername(),
                        "displayName", user.getDisplayName()),
                "message", user.getDisplayName() + " left the room",
                "timestamp", System.currentTimeMillis());
        messagingTemplate.convertAndSend("/topic/rooms/" + roomId + "/events", leaveEvent);

        return ResponseEntity.ok(Map.of("message", "Successfully left the room"));
    }

    @GetMapping("/available")
    public ResponseEntity<?> getAvailableRooms() {
        try {
            List<ChatRoom> rooms = chatRoomService.listPublicRooms();
            List<Map<String, Object>> result = rooms.stream().map(room -> Map.<String, Object>of(
                    "id", room.getId(),
                    "name", room.getName(),
                    "description", room.getDescription() != null ? room.getDescription() : "",
                    "roomType", room.getRoomType().name(),
                    "isPrivate", room.isPrivate())).toList();
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body(Map.of("error", "Failed to load rooms"));
        }
    }

    @GetMapping("/my-rooms")
    public ResponseEntity<?> getMyRooms(@AuthenticationPrincipal UserDetails principal) {
        try {
            User user = userRepository.findByUsername(principal.getUsername()).orElseThrow();
            List<RoomMembership> memberships = chatRoomService.listMembershipsForUser(user.getId());

            List<Map<String, Object>> result = memberships.stream().map(membership -> {
                ChatRoom room = membership.getRoom();
                Map<String, Object> roomData = new java.util.HashMap<>();
                roomData.put("id", room.getId());
                roomData.put("name", room.getName());
                roomData.put("description", room.getDescription() != null ? room.getDescription() : "");
                roomData.put("roomType", room.getRoomType().name());
                roomData.put("isPrivate", room.isPrivate());

                Map<String, Object> membershipData = new java.util.HashMap<>();
                membershipData.put("room", roomData);
                membershipData.put("role", membership.getRole().name());
                membershipData.put("joinedAt",
                        membership.getJoinedAt() != null ? membership.getJoinedAt().toString() : null);

                return membershipData;
            }).toList();

            return ResponseEntity.ok(result);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body(Map.of("error", "Failed to load your rooms"));
        }
    }

    @PostMapping("/direct-message")
    public ResponseEntity<?> createDirectMessage(@AuthenticationPrincipal UserDetails principal,
            @Valid @RequestBody DirectMessageRequest request) {
        if (principal == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }

        if (request == null || !request.isValid()) {
            return ResponseEntity.badRequest().body(Map.of("error", "phoneNumber or username is required"));
        }

        User currentUser = userRepository.findByUsername(principal.getUsername()).orElseThrow();
        User targetUser = null;
        if (request.phoneNumber() != null && !request.phoneNumber().trim().isEmpty()) {
            targetUser = userRepository.findByPhoneNumber(request.phoneNumber()).orElse(null);
        }
        if (targetUser == null && request.username() != null && !request.username().trim().isEmpty()) {
            targetUser = userRepository.findByUsername(request.username()).orElse(null);
        }

        if (targetUser == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "User not found"));
        }

        ChatRoom dmRoom = chatRoomService.createDirectMessage(currentUser, targetUser);
        Map<String, Object> response = new java.util.HashMap<>();
        response.put("id", dmRoom.getId());
        response.put("name", dmRoom.getName());
        response.put("roomType", dmRoom.getRoomType().name());
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{roomId}/members")
    public ResponseEntity<?> getRoomMembers(@PathVariable Long roomId) {
        List<RoomMembership> members = chatRoomService.getRoomMembers(roomId);
        if (members == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Room not found"));
        }
        return ResponseEntity.ok(members.stream().map(membership -> Map.of(
                "username", membership.getUser().getUsername(),
                "displayName", membership.getUser().getDisplayName(),
                "status", membership.getUser().getStatus(),
                "role", membership.getRole(),
                "joinedAt", membership.getJoinedAt())).toList());
    }

    @PostMapping("/create-with-options")
    public ResponseEntity<?> createRoomWithOptions(@AuthenticationPrincipal UserDetails principal,
            @Valid @RequestBody CreateRoomWithOptionsRequest request) {
        User creator = userRepository.findByUsername(principal.getUsername()).orElseThrow();

        // Validate room name uniqueness for public rooms
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
                creator);

        // If it's a private room and initial members are specified, add them
        if (request.isPrivate() && request.initialMembers() != null) {
            for (String memberIdentifier : request.initialMembers()) {
                User member = userRepository.findByUsername(memberIdentifier)
                        .orElse(userRepository.findByPhoneNumber(memberIdentifier).orElse(null));
                if (member != null) {
                    chatRoomService.addMember(room.getId(), member.getId());
                }
            }
        }

        return ResponseEntity.ok(Map.of(
                "id", room.getId(),
                "name", room.getName(),
                "description", room.getDescription(),
                "roomType", room.getRoomType(),
                "isPrivate", room.isPrivate(),
                "memberCount", chatRoomService.getRoomMemberCount(room.getId())));
    }

    public record CreateRoomWithOptionsRequest(
            @NotBlank @Size(min = 1, max = 100) String name,
            @Size(max = 500) String description,
            boolean isPrivate,
            List<String> initialMembers // usernames or phone numbers
    ) {
    }

    public record CreateRoomRequest(
            @NotBlank @Size(min = 1, max = 100) String name,
            @Size(max = 500) String description,
            String roomType, // accept string from JSON
            boolean isPrivate) {
    }

    public record DirectMessageRequest(
            String phoneNumber,
            String username) {
        public boolean isValid() {
            return (phoneNumber != null && !phoneNumber.trim().isEmpty()) ||
                    (username != null && !username.trim().isEmpty());
        }
    }
}