package com.eazybyts.chatservice.controller;

import com.eazybyts.chatservice.model.MessageType;
import com.eazybyts.chatservice.payload.ChatMessage;
import com.eazybyts.chatservice.service.MessageService;
import com.eazybyts.chatservice.service.UserService;
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
    public ChatMessage sendMessage(@Payload ChatMessage chatMessage) {
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
    public void sendPrivateMessage(@Payload ChatMessage chatMessage) {
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
    public ChatMessage addUser(@Payload ChatMessage chatMessage,
                                SimpMessageHeaderAccessor headerAccessor) {
        // Add username in web socket session
        headerAccessor.getSessionAttributes().put("username", chatMessage.getSender());

        // Set user online status
        userService.setUserOnlineStatus(chatMessage.getSender(), true);

        return chatMessage;
    }

    @MessageMapping("/chat.removeUser")
    @SendTo("/topic/public")
    public ChatMessage removeUser(@Payload ChatMessage chatMessage) {
        // Set user offline status
        userService.setUserOnlineStatus(chatMessage.getSender(), false);

        return chatMessage;
    }
}
