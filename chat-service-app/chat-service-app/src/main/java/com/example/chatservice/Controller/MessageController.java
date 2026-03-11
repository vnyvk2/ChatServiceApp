package com.example.chatservice.Controller;

import com.example.chatservice.Dto.response.MessageDto;
import com.example.chatservice.Dto.response.MessageReceiptDto;
import com.example.chatservice.Model.Message.MessageReceipt;
import com.example.chatservice.Model.User;
import com.example.chatservice.repository.UserRepository;
import com.example.chatservice.service.MessageService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/messages")
@Tag(name = "Message Management", description = "Endpoints for retrieving and decrypting messages")
public class MessageController {

    private final MessageService messageService;
    private final UserRepository userRepository;
    private final org.springframework.messaging.simp.SimpMessagingTemplate messagingTemplate;

    public MessageController(MessageService messageService, UserRepository userRepository, org.springframework.messaging.simp.SimpMessagingTemplate messagingTemplate) {
        this.messageService = messageService;
        this.userRepository = userRepository;
        this.messagingTemplate = messagingTemplate;
    }

    @GetMapping("/rooms/{roomId}")
    @Operation(summary = "Get room messages", description = "Retrieves paginated messages for a specific room.")
    public ResponseEntity<?> getRoomMessages(
            @PathVariable String roomId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            @AuthenticationPrincipal UserDetails principal) {
        if (principal == null) return ResponseEntity.status(401).build();
        User user = userRepository.findByUsername(principal.getUsername()).orElseThrow();
        org.springframework.data.domain.Page<com.example.chatservice.Model.Message> messages = messageService
                .getMessages(roomId, user.getId(), page, size);
        org.springframework.data.domain.Page<MessageDto> dtos = messages.map(msg -> new MessageDto(
                msg.getId(),
                new MessageDto.SenderDto(
                        msg.getSender().getUsername(),
                        msg.getSender().getDisplayName(),
                        msg.getSender().getStatus()),
                messageService.decrypt(msg.getEncryptedContent()),
                msg.getStatus() != null ? msg.getStatus().toString() : "SENT",
                msg.getCreatedAt(),
                msg.getEditedAt()));
        return ResponseEntity.ok(dtos);
    }

    @GetMapping("/{messageId}/receipts")
    @Operation(summary = "Get message receipts", description = "Returns per-member delivery/seen receipt details for a specific message.")
    public ResponseEntity<?> getMessageReceipts(@PathVariable String messageId) {
        try {
            List<MessageReceipt> receipts = messageService.getReceipts(messageId);
            List<MessageReceiptDto> dtos = receipts.stream()
                    .map(r -> new MessageReceiptDto(
                            r.getUserId(),
                            r.getUsername(),
                            r.getDisplayName(),
                            r.getStatus() != null ? r.getStatus().toString() : "SENT",
                            r.getDeliveredAt(),
                            r.getSeenAt()))
                    .toList();
            return ResponseEntity.ok(dtos);
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping("/decrypt")
    @Operation(summary = "Decrypt a message", description = "Decrypts the given encrypted content and returns the plaintext.")
    public ResponseEntity<?> decrypt(@RequestBody Map<String, String> body) {
        String cipher = body.get("content");
        if (cipher == null || cipher.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "No content provided"));
        }
        String plainText = messageService.decrypt(cipher);
        return ResponseEntity.ok(Map.of("decrypted", plainText));
    }

    @PostMapping("/mark-delivered-all")
    @Operation(summary = "Mark all as delivered", description = "Marks all pending SENT messages as DELIVERED for the current user across all rooms.")
    public ResponseEntity<?> markAllDelivered(@AuthenticationPrincipal UserDetails userDetails) {
        if (userDetails == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }
        User user = userRepository.findByUsername(userDetails.getUsername())
                .orElseThrow(() -> new RuntimeException("User not found"));
        List<String[]> results = messageService.markAllAsDeliveredForUser(user.getId());

        long currentTime = System.currentTimeMillis();
        for (String[] res : results) {
            String roomId = res[0];
            List<String> msgIds = java.util.Arrays.asList(res[1].split(","));

            Map<String, Object> statusEvent = new java.util.HashMap<>();
            statusEvent.put("type", "MESSAGE_STATUS_UPDATE");
            statusEvent.put("roomId", roomId);
            statusEvent.put("messageIds", msgIds);
            statusEvent.put("newStatus", "DELIVERED");
            statusEvent.put("timestamp", currentTime);

            messagingTemplate.convertAndSend("/topic/rooms/" + roomId + "/status", statusEvent);
        }

        return ResponseEntity.ok(Map.of("updated", results.size()));
    }

    @PutMapping("/rooms/{roomId}/messages/{messageId}")
    @Operation(summary = "Edit a message", description = "Edits a specific message.")
    public ResponseEntity<?> editMessage(@PathVariable String roomId,
                                         @PathVariable String messageId,
                                         @RequestBody Map<String, String> body,
                                         @AuthenticationPrincipal UserDetails principal) {
        if (principal == null) return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        String newContent = body.get("content");
        if (newContent == null || newContent.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Content cannot be empty"));
        }
        try {
            User user = userRepository.findByUsername(principal.getUsername()).orElseThrow();
            com.example.chatservice.Model.Message updatedMsg = messageService.editMessage(messageId, user.getId(), newContent);
            
            Map<String, Object> editEvent = Map.of(
                "type", "MESSAGE_EDITED",
                "roomId", roomId,
                "messageId", messageId,
                "text", newContent,
                "editedAt", updatedMsg.getEditedAt(),
                "timestamp", System.currentTimeMillis()
            );
            messagingTemplate.convertAndSend("/topic/rooms/" + roomId + "/events", editEvent);
            
            return ResponseEntity.ok(Map.of("message", "Message edited successfully"));
        } catch (RuntimeException e) {
            return ResponseEntity.status(403).body(Map.of("error", e.getMessage()));
        }
    }
}
