package com.example.chatservice.websocket;

import com.example.chatservice.service.ChatRoomService;
import com.example.chatservice.service.MessageService;
import jakarta.validation.constraints.NotBlank;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Controller;

import java.util.Map;

@Controller
public class ChatMessagingController {

    private final MessageService messageService;
    private final ChatRoomService chatRoomService;
    private final SimpMessagingTemplate messagingTemplate;

    public ChatMessagingController(MessageService messageService, ChatRoomService chatRoomService, SimpMessagingTemplate messagingTemplate) {
        this.messageService = messageService;
        this.chatRoomService = chatRoomService;
        this.messagingTemplate = messagingTemplate;
    }

    @MessageMapping("/rooms/{roomId}/send")
    public void sendToRoom(@DestinationVariable Long roomId,
                           @Payload MessagePayload payload,
                           Authentication authentication) {
        String username = authentication.getName();
        messageService.saveEncrypted(roomId, username, payload.text());
        Map<String, Object> event = Map.of(
                "roomId", roomId,
                "sender", username,
                "text", payload.text()
        );
        messagingTemplate.convertAndSend("/topic/rooms/" + roomId, event);
    }

    public record MessagePayload(@NotBlank String text) {}
}


