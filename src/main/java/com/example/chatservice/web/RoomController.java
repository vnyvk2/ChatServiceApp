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
        User creator = userRepository.findByUsername(principal.getUsername()).orElseThrow();
        ChatRoom room = chatRoomService.createRoom(
                request.name(),
                request.description(),
                request.roomType(),
                request.isPrivate(),
                creator
        );
        return ResponseEntity.ok(Map.of(
                "id", room.getId(),
                "name", room.getName(),
                "description", room.getDescription(),
                "roomType", room.getRoomType(),
                "isPrivate", room.isPrivate()
        ));
    }

    @PostMapping("/{roomId}/join")
    public ResponseEntity<?> joinRoom(@PathVariable Long roomId,
                                      @AuthenticationPrincipal UserDetails principal) {
        User user = userRepository.findByUsername(principal.getUsername()).orElseThrow();
        RoomMembership membership = chatRoomService.addMember(roomId, user.getId());

        // Broadcast join notification
        Map<String, Object> joinEvent = Map.of(
                "type", "USER_JOINED",
                "roomId", roomId,
                "user", Map.of(
                        "username", user.getUsername(),
                        "displayName", user.getDisplayName()
                ),
                "message", user.getDisplayName() + " joined the room",
                "timestamp", System.currentTimeMillis()
        );
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
                        "displayName", user.getDisplayName()
                ),
                "message", user.getDisplayName() + " left the room",
                "timestamp", System.currentTimeMillis()
        );
        messagingTemplate.convertAndSend("/topic/rooms/" + roomId + "/events", leaveEvent);

        return ResponseEntity.ok(Map.of("message", "Successfully left the room"));
    }

    @GetMapping("/available")
    public List<ChatRoom> getAvailableRooms() {
        return chatRoomService.listPublicRooms();
    }

    @GetMapping("/my-rooms")
    public List<RoomMembership> getMyRooms(@AuthenticationPrincipal UserDetails principal) {
        User user = userRepository.findByUsername(principal.getUsername()).orElseThrow();
        return chatRoomService.listMembershipsForUser(user.getId());
    }

    @PostMapping("/direct-message")
    public ResponseEntity<?> createDirectMessage(@AuthenticationPrincipal UserDetails principal,
                                                 @Valid @RequestBody DirectMessageRequest request) {
        User currentUser = userRepository.findByUsername(principal.getUsername()).orElseThrow();
        User targetUser = userRepository.findByPhoneNumber(request.phoneNumber())
                .orElse(userRepository.findByUsername(request.username()).orElse(null));

        if (targetUser == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "User not found"));
        }

        ChatRoom dmRoom = chatRoomService.createDirectMessage(currentUser, targetUser);
        return ResponseEntity.ok(Map.of(
                "id", dmRoom.getId(),
                "name", dmRoom.getName(),
                "roomType", dmRoom.getRoomType()
        ));
    }

    @GetMapping("/{roomId}/members")
    public ResponseEntity<?> getRoomMembers(@PathVariable Long roomId) {
        List<RoomMembership> members = chatRoomService.getRoomMembers(roomId);
        return ResponseEntity.ok(members.stream().map(membership -> Map.of(
                "username", membership.getUser().getUsername(),
                "displayName", membership.getUser().getDisplayName(),
                "status", membership.getUser().getStatus(),
                "role", membership.getRole(),
                "joinedAt", membership.getJoinedAt()
        )).toList());
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
                creator
        );

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
                "memberCount", chatRoomService.getRoomMemberCount(room.getId())
        ));
    }

    public record CreateRoomWithOptionsRequest(
            @NotBlank @Size(min = 1, max = 100) String name,
            @Size(max = 500) String description,
            boolean isPrivate,
            List<String> initialMembers // usernames or phone numbers
    ) {}

    public record CreateRoomRequest(
            @NotBlank @Size(min = 1, max = 100) String name,
            @Size(max = 500) String description,
            ChatRoom.RoomType roomType,
            boolean isPrivate
    ) {}

    public record DirectMessageRequest(
            String phoneNumber,
            String username
    ) {
        public boolean isValid() {
            return (phoneNumber != null && !phoneNumber.trim().isEmpty()) ||
                    (username != null && !username.trim().isEmpty());
        }
    }
}