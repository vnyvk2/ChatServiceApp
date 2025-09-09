package com.example.chatservice.web;

import com.example.chatservice.domain.ChatRoom;
import com.example.chatservice.domain.RoomMembership;
import com.example.chatservice.domain.User;
import com.example.chatservice.repository.UserRepository;
import com.example.chatservice.service.ChatRoomService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/rooms")
public class RoomController {

    private final ChatRoomService chatRoomService;
    private final UserRepository userRepository;

    public RoomController(ChatRoomService chatRoomService, UserRepository userRepository) {
        this.chatRoomService = chatRoomService;
        this.userRepository = userRepository;
    }

    @PostMapping
    public ResponseEntity<?> create(@AuthenticationPrincipal UserDetails principal,
                                    @Valid @RequestBody CreateRoomRequest request) {
        ChatRoom room = chatRoomService.createRoom(request.name(), request.isPrivate(), principal.getUsername());
        return ResponseEntity.ok(Map.of("id", room.getId(), "name", room.getName()));
    }

    @PostMapping("/{roomId}/members/{username}")
    public ResponseEntity<?> addMember(@PathVariable Long roomId, @PathVariable String username) {
        User user = userRepository.findByUsername(username).orElseThrow();
        chatRoomService.addMember(roomId, user.getId());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/me")
    public List<RoomMembership> myRooms(@AuthenticationPrincipal UserDetails principal) {
        User user = userRepository.findByUsername(principal.getUsername()).orElseThrow();
        return chatRoomService.listMembershipsForUser(user.getId());
    }

    public record CreateRoomRequest(@NotBlank String name, boolean isPrivate) {}
}


