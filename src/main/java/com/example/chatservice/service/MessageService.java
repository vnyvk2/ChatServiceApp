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
import org.springframework.transaction.annotation.Transactional;

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

    @Transactional
    public Message saveEncrypted(Long roomId, String senderUsername, String content) {
        User sender = userRepository.findByUsername(senderUsername)
                .orElseThrow(() -> new RuntimeException("User not found"));
        ChatRoom room = chatRoomRepository.findById(roomId)
                .orElseThrow(() -> new RuntimeException("Room not found"));

        String encryptedContent = cryptoService.encrypt(content);

        Message message = new Message();
        message.setRoom(room);
        message.setSender(sender);
        message.setEncryptedContent(encryptedContent);
        message.setMessageType(Message.MessageType.TEXT);

        return messageRepository.save(message);
    }

    @Transactional(readOnly = true)
    public List<Message> getRecentMessages(Long roomId, int limit) {
        Pageable pageable = PageRequest.of(0, limit, Sort.by("createdAt").descending());
        return messageRepository.findByRoom_IdOrderByCreatedAtDesc(roomId, pageable);
    }

    @Transactional(readOnly = true)
    public List<Message> getAllMessagesInRoom(Long roomId) {
        return messageRepository.findByRoom_IdOrderByCreatedAtAsc(roomId);
    }

    @Transactional(readOnly = true)
    public String decryptMessage(Message message) {
        return cryptoService.decrypt(message.getEncryptedContent());
    }

    @Transactional(readOnly = true)
    public Optional<Message> findById(Long messageId) {
        return messageRepository.findById(messageId);
    }

    @Transactional
    public void deleteMessage(Long messageId) {
        messageRepository.deleteById(messageId);
    }

    @Transactional(readOnly = true)
    public long getMessageCountInRoom(Long roomId) {
        return messageRepository.countByRoom_Id(roomId);
    }

    // --------- NEW methods required by controller ---------

    /**
     * Returns a page of messages for a room. Sorted by createdAt descending by default.
     */
    @Transactional(readOnly = true)
    public Page<Message> getMessages(Long roomId, int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return messageRepository.findByRoom_Id(roomId, pageable);
    }

    /**
     * Decrypt raw cipher text (used by controller /decrypt endpoint).
     */
    @Transactional(readOnly = true)
    public String decrypt(String cipher) {
        return cryptoService.decrypt(cipher);
    }
}
