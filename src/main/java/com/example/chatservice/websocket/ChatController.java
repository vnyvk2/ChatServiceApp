package com.example.chatservice.websocket;

import com.example.chatservice.domain.MessageType;
import com.example.chatservice.web.MessageDto;
import com.example.chatservice.service.MessageService;
import com.example.chatservice.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

@Controller
public class ChatController {

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @Autowired
    private MessageService messageService;

    @Autowired
    private UserService userService;

    @MessageMapping("/chat.sendMessage")
    @SendTo("/topic/public")
    public MessageDto sendMessage(@Payload MessageDto chatMessage) {
        // Save message to database
        if (chatMessage.getChatRoomId() != null) {
            messageService.saveMessage(
                    chatMessage.getContent(),
                    chatMessage.getSender(),
                    chatMessage.getChatRoomId(),
                    MessageType.CHAT
            );
        }

        return chatMessage;
    }

    @MessageMapping("/chat.sendPrivateMessage")
    public void sendPrivateMessage(@Payload MessageDto chatMessage) {
        // Save private message to database
        messageService.savePrivateMessage(
                chatMessage.getContent(),
                chatMessage.getSender(),
                chatMessage.getRecipient()
        );

        // Send to specific user
        messagingTemplate.convertAndSendToUser(
                chatMessage.getRecipient(),
                "/queue/messages",
                chatMessage
        );
    }

    @MessageMapping("/chat.addUser")
    @SendTo("/topic/public")
    public MessageDto addUser(@Payload MessageDto chatMessage,
                                SimpMessageHeaderAccessor headerAccessor) {
        // Add username in web socket session
        headerAccessor.getSessionAttributes().put("username", chatMessage.getSender());

        // Set user online status
        userService.setUserOnlineStatus(chatMessage.getSender(), true);

        return chatMessage;
    }

    @MessageMapping("/chat.removeUser")
    @SendTo("/topic/public")
    public MessageDto removeUser(@Payload MessageDto chatMessage) {
        // Set user offline status
        userService.setUserOnlineStatus(chatMessage.getSender(), false);

        return chatMessage;
    }
}
