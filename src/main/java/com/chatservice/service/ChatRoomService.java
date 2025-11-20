package com.chatservice.service;

import com.chatservice.model.ChatRoom;
import com.chatservice.model.User;
import com.chatservice.repository.ChatRoomRepository;
import com.chatservice.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
@Transactional
public class ChatRoomService {
    @Autowired
    private ChatRoomRepository chatRoomRepository;

    @Autowired
    private UserRepository userRepository;

    public List<ChatRoom> getAllPublicRooms() {
        return chatRoomRepository.findAllPublicRooms();
    }

    public Optional<ChatRoom> getChatRoomById(Long id) {
        return chatRoomRepository.findById(id);
    }

    public ChatRoom createChatRoom(String name, String description, String creatorUsername) {
        Optional<User> creatorOpt = userRepository.findByUsername(creatorUsername);
        if (creatorOpt.isEmpty()) {
            throw new RuntimeException("User not found");
        }

        if (chatRoomRepository.existsByName(name)) {
            throw new RuntimeException("Chat room with this name already exists");
        }

        User creator = creatorOpt.get();
        ChatRoom chatRoom = new ChatRoom(name, description, creator);
        chatRoom = chatRoomRepository.save(chatRoom);

        // Add creator to the room
        creator.getChatRooms().add(chatRoom);
        userRepository.save(creator);

        return chatRoom;
    }

    public void joinChatRoom(Long roomId, String username) {
        Optional<ChatRoom> roomOpt = chatRoomRepository.findById(roomId);
        Optional<User> userOpt = userRepository.findByUsername(username);

        if (roomOpt.isEmpty() || userOpt.isEmpty()) {
            throw new RuntimeException("Room or user not found");
        }

        User user = userOpt.get();
        ChatRoom room = roomOpt.get();

        user.getChatRooms().add(room);
        userRepository.save(user);
    }

    public void leaveChatRoom(Long roomId, String username) {
        Optional<ChatRoom> roomOpt = chatRoomRepository.findById(roomId);
        Optional<User> userOpt = userRepository.findByUsername(username);

        if (roomOpt.isEmpty() || userOpt.isEmpty()) {
            throw new RuntimeException("Room or user not found");
        }

        User user = userOpt.get();
        ChatRoom room = roomOpt.get();

        user.getChatRooms().remove(room);
        userRepository.save(user);
    }

    public List<ChatRoom> getUserChatRooms(Long userId) {
        return chatRoomRepository.findRoomsByUserId(userId);
    }
}
