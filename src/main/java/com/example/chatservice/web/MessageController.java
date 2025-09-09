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
    public Page<Message> getRoomMessages(@PathVariable Long roomId,
                                         @RequestParam(defaultValue = "0") int page,
                                         @RequestParam(defaultValue = "50") int size) {
        return messageService.getMessages(roomId, page, size);
    }

    @PostMapping("/decrypt")
    public ResponseEntity<?> decrypt(@RequestBody Map<String, String> body) {
        String cipher = body.get("cipher");
        return ResponseEntity.ok(Map.of("plain", messageService.decrypt(cipher)));
    }
}


