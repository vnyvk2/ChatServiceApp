package com.chatservice.controller;

import com.chatservice.service.ChatRoomService;
import com.chatservice.model.ChatRoom;
import com.chatservice.payload.response.MessageResponse;
import com.chatservice.security.services.UserDetailsImpl;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/chatrooms")
public class ChatRoomController {
    @Autowired
    private ChatRoomService chatRoomService;

    @GetMapping("/public")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> getPublicChatRooms() {
        List<ChatRoom> chatRooms = chatRoomService.getAllPublicRooms();

        List<Map<String, Object>> roomList = chatRooms.stream()
                .map(room -> {
                    Map<String, Object> roomMap = new HashMap<>();
                    roomMap.put("id", room.getId());
                    roomMap.put("name", room.getName());
                    roomMap.put("description", room.getDescription());
                    roomMap.put("creator", room.getCreator().getUsername());
                    roomMap.put("memberCount", room.getMembers().size());
                    roomMap.put("createdAt", room.getCreatedAt());
                    return roomMap;
                })
                .collect(Collectors.toList());

        return ResponseEntity.ok(roomList);
    }

    @PostMapping("/create")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> createChatRoom(@RequestBody Map<String, String> request) {
        UserDetailsImpl userDetails = (UserDetailsImpl) SecurityContextHolder.getContext()
                .getAuthentication().getPrincipal();

        try {
            ChatRoom chatRoom = chatRoomService.createChatRoom(
                    request.get("name"),
                    request.get("description"),
                    userDetails.getUsername()
            );

            Map<String, Object> response = new HashMap<>();
            response.put("id", chatRoom.getId());
            response.put("name", chatRoom.getName());
            response.put("description", chatRoom.getDescription());

            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(new MessageResponse(e.getMessage()));
        }
    }

    @PostMapping("/{id}/join")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> joinChatRoom(@PathVariable Long id) {
        UserDetailsImpl userDetails = (UserDetailsImpl) SecurityContextHolder.getContext()
                .getAuthentication().getPrincipal();

        try {
            chatRoomService.joinChatRoom(id, userDetails.getUsername());
            return ResponseEntity.ok(new MessageResponse("Joined chat room successfully"));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(new MessageResponse(e.getMessage()));
        }
    }

    @PostMapping("/{id}/leave")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> leaveChatRoom(@PathVariable Long id) {
        UserDetailsImpl userDetails = (UserDetailsImpl) SecurityContextHolder.getContext()
                .getAuthentication().getPrincipal();

        try {
            chatRoomService.leaveChatRoom(id, userDetails.getUsername());
            return ResponseEntity.ok(new MessageResponse("Left chat room successfully"));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(new MessageResponse(e.getMessage()));
        }
    }

    @GetMapping("/{id}/messages")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> getChatRoomMessages(@PathVariable Long id) {
        // This will be handled by MessageController
        return ResponseEntity.ok(new MessageResponse("Use /api/messages/chatroom/{id}"));
    }
}
