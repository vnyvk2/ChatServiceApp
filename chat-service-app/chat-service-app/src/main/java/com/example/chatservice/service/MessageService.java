package com.example.chatservice.service;

import com.example.chatservice.domain.ChatRoom;
import com.example.chatservice.domain.Message;
import com.example.chatservice.domain.User;
import com.example.chatservice.repository.ChatRoomRepository;
import com.example.chatservice.repository.MessageRepository;
import com.example.chatservice.repository.UserRepository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class MessageService {

    private final MessageRepository messageRepository;
    private final UserRepository userRepository;
    private final ChatRoomRepository chatRoomRepository;
    private final CryptoService cryptoService;

    public MessageService(MessageRepository messageRepository,
            UserRepository userRepository,
            ChatRoomRepository chatRoomRepository,
            CryptoService cryptoService) {
        this.messageRepository = messageRepository;
        this.userRepository = userRepository;
        this.chatRoomRepository = chatRoomRepository;
        this.cryptoService = cryptoService;
    }

    public Message saveEncrypted(String roomId, String senderUsername, String content) {
        System.out.println("MessageService.saveEncrypted called for room " + roomId + " by " + senderUsername);
        User sender = userRepository.findByUsername(senderUsername)
                .orElseThrow(() -> new RuntimeException("User not found"));
        ChatRoom room = chatRoomRepository.findById(roomId)
                .orElseThrow(() -> new RuntimeException("Room not found"));

        System.out.println("Encrypting content...");
        String encryptedContent = cryptoService.encrypt(content);
        System.out.println("Content encrypted.");

        Message message = new Message();
        message.setRoom(room);
        message.setSender(sender);
        message.setEncryptedContent(encryptedContent);
        message.setMessageType(Message.MessageType.TEXT);

        System.out.println("Saving message entity...");
        return messageRepository.save(message);
    }

    public List<Message> getRecentMessages(String roomId, int limit) {
        Pageable pageable = PageRequest.of(0, limit, Sort.by("createdAt").descending());
        return messageRepository.findByRoomIdOrderByCreatedAtDesc(roomId, pageable);
    }

    public List<Message> getAllMessagesInRoom(String roomId) {
        return messageRepository.findByRoomIdOrderByCreatedAtAsc(roomId);
    }

    public String decryptMessage(Message message) {
        return cryptoService.decrypt(message.getEncryptedContent());
    }

    public Optional<Message> findById(String messageId) {
        return messageRepository.findById(messageId);
    }

    public void deleteMessage(String messageId) {
        messageRepository.deleteById(messageId);
    }

    public long getMessageCountInRoom(String roomId) {
        return messageRepository.countByRoomId(roomId);
    }

    // --------- Pagination method ---------

    /**
     * Returns a page of messages for a room. Sorted by createdAt descending by
     * default.
     */
    public Page<Message> getMessages(String roomId, int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return messageRepository.findByRoomId(roomId, pageable);
    }

    /**
     * Decrypt raw cipher text (used by controller /decrypt endpoint).
     */
    public String decrypt(String cipher) {
        try {
            return cryptoService.decrypt(cipher);
        } catch (Exception e) {
            System.err.println("Failed to decrypt message: " + e.getMessage());
            return "[Encrypted Message]"; // Fallback instead of failing the request
        }
    }
}
