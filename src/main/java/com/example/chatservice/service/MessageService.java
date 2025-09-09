package com.example.chatservice.service;

import com.example.chatservice.domain.ChatRoom;
import com.example.chatservice.domain.Message;
import com.example.chatservice.domain.User;
import com.example.chatservice.repository.ChatRoomRepository;
import com.example.chatservice.repository.MessageRepository;
import com.example.chatservice.repository.UserRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MessageService {

    private final MessageRepository messageRepository;
    private final ChatRoomRepository chatRoomRepository;
    private final UserRepository userRepository;
    private final CryptoService cryptoService;

    public MessageService(MessageRepository messageRepository, ChatRoomRepository chatRoomRepository, UserRepository userRepository, CryptoService cryptoService) {
        this.messageRepository = messageRepository;
        this.chatRoomRepository = chatRoomRepository;
        this.userRepository = userRepository;
        this.cryptoService = cryptoService;
    }

    @Transactional
    public Message saveEncrypted(Long roomId, String senderUsername, String plainText) {
        ChatRoom room = chatRoomRepository.findById(roomId).orElseThrow();
        User sender = userRepository.findByUsername(senderUsername).orElseThrow();
        Message message = new Message();
        message.setRoom(room);
        message.setSender(sender);
        message.setCipherText(cryptoService.encrypt(plainText));
        return messageRepository.save(message);
    }

    public Page<Message> getMessages(Long roomId, int page, int size) {
        return messageRepository.findByRoom_IdOrderByCreatedAtAsc(roomId, PageRequest.of(page, size));
    }

    public String decrypt(String cipherText) {
        return cryptoService.decrypt(cipherText);
    }
}


