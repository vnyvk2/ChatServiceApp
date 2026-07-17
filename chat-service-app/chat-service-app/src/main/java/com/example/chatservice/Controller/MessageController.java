package com.example.chatservice.Controller;

import com.example.chatservice.Dto.response.MessageDto;
import com.example.chatservice.Dto.response.MessageReceiptDto;
import com.example.chatservice.Model.User;
import com.example.chatservice.service.MessageService;
import com.example.chatservice.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.data.domain.Page;
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
    private final UserService userService;

    public MessageController(MessageService messageService, UserService userService) {
        this.messageService = messageService;
        this.userService = userService;
    }

    @GetMapping("/rooms/{roomId}")
    @Operation(summary = "Get room messages", description = "Retrieves paginated messages for a specific room.")
    public ResponseEntity<Page<MessageDto>> getRoomMessages(
            @PathVariable String roomId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            @AuthenticationPrincipal UserDetails principal) {
        if (principal == null) {
            return ResponseEntity.status(401).build();
        }
        User user = userService.resolveUserByUsername(principal.getUsername());
        Page<MessageDto> dtos = messageService.getMessageDtos(roomId, user.getId(), page, size);
        return ResponseEntity.ok(dtos);
    }

    @GetMapping("/{messageId}/receipts")
    @Operation(summary = "Get message receipts", description = "Returns per-member delivery/seen receipt details for a specific message.")
    public ResponseEntity<List<MessageReceiptDto>> getMessageReceipts(@PathVariable String messageId) {
        List<MessageReceiptDto> dtos = messageService.getReceiptDtos(messageId);
        return ResponseEntity.ok(dtos);
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
        User user = userService.resolveUserByUsername(userDetails.getUsername());
        int updated = messageService.markAllDeliveredAndBroadcast(user.getId());
        return ResponseEntity.ok(Map.of("updated", updated));
    }

    @PutMapping("/rooms/{roomId}/messages/{messageId}")
    @Operation(summary = "Edit a message", description = "Edits a specific message.")
    public ResponseEntity<?> editMessage(@PathVariable String roomId,
            @PathVariable String messageId,
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal UserDetails principal) {
        if (principal == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }
        String newContent = body.get("content");
        if (newContent == null || newContent.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Content cannot be empty"));
        }
        User user = userService.resolveUserByUsername(principal.getUsername());
        messageService.editMessageAndBroadcast(roomId, messageId, user.getId(), newContent);
        return ResponseEntity.ok(Map.of("message", "Message edited successfully"));
    }
}
