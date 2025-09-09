package com.example.chatservice.service;

import com.example.chatservice.domain.ChatRoom;
import com.example.chatservice.domain.RoomMembership;
import com.example.chatservice.domain.User;
import com.example.chatservice.repository.ChatRoomRepository;
import com.example.chatservice.repository.RoomMembershipRepository;
import com.example.chatservice.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class ChatRoomService {

    private final ChatRoomRepository chatRoomRepository;
    private final RoomMembershipRepository membershipRepository;
    private final UserRepository userRepository;

    public ChatRoomService(ChatRoomRepository chatRoomRepository, RoomMembershipRepository membershipRepository, UserRepository userRepository) {
        this.chatRoomRepository = chatRoomRepository;
        this.membershipRepository = membershipRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public ChatRoom createRoom(String name, boolean isPrivate, String creatorUsername) {
        ChatRoom room = new ChatRoom();
        room.setName(name);
        room.setPrivate(isPrivate);
        chatRoomRepository.save(room);

        User creator = userRepository.findByUsername(creatorUsername).orElseThrow();
        addMember(room.getId(), creator.getId());
        return room;
    }

    @Transactional
    public void addMember(Long roomId, Long userId) {
        if (!membershipRepository.existsByRoom_IdAndUser_Id(roomId, userId)) {
            ChatRoom room = chatRoomRepository.findById(roomId).orElseThrow();
            User user = userRepository.findById(userId).orElseThrow();
            RoomMembership membership = new RoomMembership();
            membership.setRoom(room);
            membership.setUser(user);
            membershipRepository.save(membership);
        }
    }

    public boolean isMember(Long roomId, Long userId) {
        return membershipRepository.existsByRoom_IdAndUser_Id(roomId, userId);
    }

    public List<RoomMembership> listMembershipsForUser(Long userId) {
        return membershipRepository.findByUser_Id(userId);
    }
}


