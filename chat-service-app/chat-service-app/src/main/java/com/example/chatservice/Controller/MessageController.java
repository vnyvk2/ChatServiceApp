package com.example.chatservice.Controller;

import com.example.chatservice.Dto.response.MessageDto;
import com.example.chatservice.Dto.response.MessageReceiptDto;
import com.example.chatservice.Model.Message.MessageReceipt;
import com.example.chatservice.service.MessageService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/messages")
@Tag(name = "Message Management", description = "Endpoints for retrieving and decrypting messages")
public class MessageController {

    private final MessageService messageService;

    public MessageController(MessageService messageService) {
        this.messageService = messageService;
    }

    @GetMapping("/rooms/{roomId}")
    @Operation(summary = "Get room messages", description = "Retrieves paginated messages for a specific room.")
    public ResponseEntity<?> getRoomMessages(
            @PathVariable String roomId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        org.springframework.data.domain.Page<com.example.chatservice.Model.Message> messages = messageService
                .getMessages(roomId, page, size);
        org.springframework.data.domain.Page<MessageDto> dtos = messages.map(msg -> new MessageDto(
                msg.getId(),
                new MessageDto.SenderDto(
                        msg.getSender().getUsername(),
                        msg.getSender().getDisplayName(),
                        msg.getSender().getStatus()),
                messageService.decrypt(msg.getEncryptedContent()),
                msg.getStatus() != null ? msg.getStatus().toString() : "SENT",
                msg.getCreatedAt()));
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
}
