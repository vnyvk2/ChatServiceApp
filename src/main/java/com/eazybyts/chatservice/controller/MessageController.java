package com.eazybyts.chatservice.controller;

import com.eazybyts.chatservice.model.Message;
import com.eazybyts.chatservice.payload.response.MessageResponse;
import com.eazybyts.chatservice.security.services.UserDetailsImpl;
import com.eazybyts.chatservice.service.MessageService;
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
@RequestMapping("/api/messages")
public class MessageController {
    @Autowired
    private MessageService messageService;

    @GetMapping("/private/{username}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> getPrivateMessages(@PathVariable String username) {
        UserDetailsImpl userDetails = (UserDetailsImpl) SecurityContextHolder.getContext()
                .getAuthentication().getPrincipal();

        try {
            List<Message> messages = messageService.getPrivateMessages(
                    userDetails.getUsername(),
                    username
            );

            List<Map<String, Object>> messageList = messages.stream()
                    .map(msg -> {
                        Map<String, Object> msgMap = new HashMap<>();
                        msgMap.put("id", msg.getId());
                        msgMap.put("content", msg.getContent());
                        msgMap.put("sender", msg.getSender().getUsername());
                        msgMap.put("createdAt", msg.getCreatedAt());
                        msgMap.put("isRead", msg.getIsRead());
                        return msgMap;
                    })
                    .collect(Collectors.toList());

            return ResponseEntity.ok(messageList);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(new MessageResponse(e.getMessage()));
        }
    }

    @GetMapping("/chatroom/{roomId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> getChatRoomMessages(@PathVariable Long roomId) {
        List<Message> messages = messageService.getChatRoomMessages(roomId);

        List<Map<String, Object>> messageList = messages.stream()
                .map(msg -> {
                    Map<String, Object> msgMap = new HashMap<>();
                    msgMap.put("id", msg.getId());
                    msgMap.put("content", msg.getContent());
                    msgMap.put("sender", msg.getSender().getUsername());
                    msgMap.put("type", msg.getType());
                    msgMap.put("createdAt", msg.getCreatedAt());
                    return msgMap;
                })
                .collect(Collectors.toList());

        return ResponseEntity.ok(messageList);
    }

    @GetMapping("/unread")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> getUnreadMessages() {
        UserDetailsImpl userDetails = (UserDetailsImpl) SecurityContextHolder.getContext()
                .getAuthentication().getPrincipal();

        List<Message> messages = messageService.getUnreadMessages(userDetails.getUsername());

        List<Map<String, Object>> messageList = messages.stream()
                .map(msg -> {
                    Map<String, Object> msgMap = new HashMap<>();
                    msgMap.put("id", msg.getId());
                    msgMap.put("content", msg.getContent());
                    msgMap.put("sender", msg.getSender().getUsername());
                    msgMap.put("createdAt", msg.getCreatedAt());
                    return msgMap;
                })
                .collect(Collectors.toList());

        return ResponseEntity.ok(messageList);
    }

    @GetMapping("/unread/count")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> getUnreadMessageCount() {
        UserDetailsImpl userDetails = (UserDetailsImpl) SecurityContextHolder.getContext()
                .getAuthentication().getPrincipal();

        Long count = messageService.getUnreadMessageCount(userDetails.getUsername());

        Map<String, Object> response = new HashMap<>();
        response.put("count", count);

        return ResponseEntity.ok(response);
    }

    @PostMapping("/mark-read/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> markMessageAsRead(@PathVariable Long id) {
        messageService.markMessageAsRead(id);
        return ResponseEntity.ok(new MessageResponse("Message marked as read"));
    }
}
