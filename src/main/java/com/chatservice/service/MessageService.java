package com.chatservice.service;

import com.chatservice.model.ChatRoom;
import com.chatservice.model.Message;
import com.chatservice.model.MessageType;
import com.chatservice.model.User;
import com.chatservice.repository.ChatRoomRepository;
import com.chatservice.repository.MessageRepository;
import com.chatservice.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
@Transactional
public class MessageService {
    @Autowired
    private MessageRepository messageRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ChatRoomRepository chatRoomRepository;

    public Message saveMessage(String content, String senderUsername, Long chatRoomId, MessageType type) {
        Optional<User> senderOpt = userRepository.findByUsername(senderUsername);
        if (senderOpt.isEmpty()) {
            throw new RuntimeException("Sender not found");
        }

        Message message = new Message(content, senderOpt.get(), type);

        if (chatRoomId != null) {
            Optional<ChatRoom> roomOpt = chatRoomRepository.findById(chatRoomId);
            if (roomOpt.isPresent()) {
                message.setChatRoom(roomOpt.get());
            }
        }

        return messageRepository.save(message);
    }

    public Message savePrivateMessage(String content, String senderUsername, String recipientUsername) {
        Optional<User> senderOpt = userRepository.findByUsername(senderUsername);
        Optional<User> recipientOpt = userRepository.findByUsername(recipientUsername);

        if (senderOpt.isEmpty() || recipientOpt.isEmpty()) {
            throw new RuntimeException("Sender or recipient not found");
        }

        Message message = new Message(content, senderOpt.get(), MessageType.PRIVATE);
        message.setRecipient(recipientOpt.get());

        return messageRepository.save(message);
    }

    public List<Message> getChatRoomMessages(Long chatRoomId) {
        return messageRepository.findByChatRoomId(chatRoomId);
    }

    public List<Message> getPrivateMessages(String username1, String username2) {
        Optional<User> user1Opt = userRepository.findByUsername(username1);
        Optional<User> user2Opt = userRepository.findByUsername(username2);

        if (user1Opt.isEmpty() || user2Opt.isEmpty()) {
            throw new RuntimeException("One or both users not found");
        }

        return messageRepository.findPrivateMessages(user1Opt.get().getId(), user2Opt.get().getId());
    }

    public List<Message> getUnreadMessages(String username) {
        Optional<User> userOpt = userRepository.findByUsername(username);
        if (userOpt.isEmpty()) {
            throw new RuntimeException("User not found");
        }

        return messageRepository.findUnreadMessages(userOpt.get().getId());
    }

    public Long getUnreadMessageCount(String username) {
        Optional<User> userOpt = userRepository.findByUsername(username);
        if (userOpt.isEmpty()) {
            return 0L;
        }

        return messageRepository.countUnreadMessages(userOpt.get().getId());
    }

    public void markMessageAsRead(Long messageId) {
        Optional<Message> messageOpt = messageRepository.findById(messageId);
        if (messageOpt.isPresent()) {
            Message message = messageOpt.get();
            message.setIsRead(true);
            messageRepository.save(message);
        }
    }
}
