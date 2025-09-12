package com.example.chatservice.web;

import com.example.chatservice.domain.Message;
import com.example.chatservice.service.MessageService;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/messages")
public class MessageController {

    private final MessageService messageService;

    public MessageController(MessageService messageService) {
        this.messageService = messageService;
    }

    @GetMapping("/rooms/{roomId}")
    public Page<MessageDto> getRoomMessages(@PathVariable Long roomId, // Return Page<MessageDto>
                                            @RequestParam(defaultValue = "0") int page,
                                            @RequestParam(defaultValue = "50") int size) {
        Page<Message> messagePage = messageService.getMessages(roomId, page, size);

        // Map the Page<Message> to Page<MessageDto>
        return messagePage.map(message -> {
            String decryptedText = messageService.decrypt(message.getEncryptedContent());
            var senderDto = new MessageDto.SenderDto(
                    message.getSender().getUsername(),
                    message.getSender().getDisplayName(),
                    message.getSender().getStatus()
            );
            return new MessageDto(message.getId(), senderDto, decryptedText, message.getCreatedAt());
        });
    }

    @PostMapping("/decrypt")
    public ResponseEntity<?> decrypt(@RequestBody Map<String, String> body) {
        String cipher = body.get("cipher");
        return ResponseEntity.ok(Map.of("plain", messageService.decrypt(cipher)));
    }
}


