// Enhanced ChatRoomService.java
package com.example.chatservice.service;

import com.example.chatservice.domain.ChatRoom;
import com.example.chatservice.domain.RoomMembership;
import com.example.chatservice.domain.User;
import com.example.chatservice.repository.ChatRoomRepository;
import com.example.chatservice.repository.RoomMembershipRepository;
import com.example.chatservice.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Service
public class ChatRoomService {

    private final ChatRoomRepository chatRoomRepository;
    private final RoomMembershipRepository membershipRepository;
    private final UserRepository userRepository;

    public ChatRoomService(ChatRoomRepository chatRoomRepository,
                           RoomMembershipRepository membershipRepository,
                           UserRepository userRepository) {
        this.chatRoomRepository = chatRoomRepository;
        this.membershipRepository = membershipRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public ChatRoom createRoom(String name, String description, ChatRoom.RoomType roomType,
                               boolean isPrivate, User creator) {
        ChatRoom room = new ChatRoom();
        room.setName(name);
        room.setDescription(description);
        room.setRoomType(roomType);
        room.setPrivate(isPrivate);
        room.setCreatedBy(creator);
        room = chatRoomRepository.save(room);

        // Add creator as admin
        RoomMembership membership = new RoomMembership();
        membership.setRoom(room);
        membership.setUser(creator);
        membership.setRole(RoomMembership.Role.ADMIN);
        membershipRepository.save(membership);

        return room;
    }

    @Transactional
    public ChatRoom createDirectMessage(User user1, User user2) {
        // Check if DM already exists
        String roomName = "DM_" + Math.min(user1.getId(), user2.getId()) + "_" + Math.max(user1.getId(), user2.getId());
        Optional<ChatRoom> existing = chatRoomRepository.findByNameAndRoomType(roomName, ChatRoom.RoomType.DIRECT_MESSAGE);

        if (existing.isPresent()) {
            return existing.get();
        }

        // Create new DM room
        ChatRoom dmRoom = new ChatRoom();
        dmRoom.setName(roomName);
        dmRoom.setDescription("Direct message between " + user1.getDisplayName() + " and " + user2.getDisplayName());
        dmRoom.setRoomType(ChatRoom.RoomType.DIRECT_MESSAGE);
        dmRoom.setPrivate(true);
        dmRoom.setCreatedBy(user1);
        dmRoom = chatRoomRepository.save(dmRoom);

        // Add both users as members
        RoomMembership membership1 = new RoomMembership();
        membership1.setRoom(dmRoom);
        membership1.setUser(user1);
        membership1.setRole(RoomMembership.Role.MEMBER);
        membershipRepository.save(membership1);

        RoomMembership membership2 = new RoomMembership();
        membership2.setRoom(dmRoom);
        membership2.setUser(user2);
        membership2.setRole(RoomMembership.Role.MEMBER);
        membershipRepository.save(membership2);

        return dmRoom;
    }

    @Transactional
    public RoomMembership addMember(Long roomId, Long userId) {
        ChatRoom room = chatRoomRepository.findById(roomId).orElseThrow();
        User user = userRepository.findById(userId).orElseThrow();

        // Check if membership already exists
        Optional<RoomMembership> existing = membershipRepository.findByRoomIdAndUserId(roomId, userId);
        if (existing.isPresent()) {
            RoomMembership membership = existing.get();
            if (!membership.isActive()) {
                membership.setActive(true);
                membership.setLeftAt(null);
                return membershipRepository.save(membership);
            }
            return membership;
        }

        RoomMembership membership = new RoomMembership();
        membership.setRoom(room);
        membership.setUser(user);
        membership.setRole(RoomMembership.Role.MEMBER);
        return membershipRepository.save(membership);
    }

    @Transactional
    public void removeMember(Long roomId, Long userId) {
        Optional<RoomMembership> membership = membershipRepository.findByRoomIdAndUserId(roomId, userId);
        if (membership.isPresent()) {
            RoomMembership rm = membership.get();
            rm.setActive(false);
            rm.setLeftAt(Instant.now());
            membershipRepository.save(rm);
        }
    }

    public List<RoomMembership> listMembershipsForUser(Long userId) {
        return membershipRepository.findByUserIdAndIsActiveTrue(userId);
    }

    public List<RoomMembership> getRoomMembers(Long roomId) {
        return membershipRepository.findByRoomIdAndIsActiveTrue(roomId);
    }

    public List<ChatRoom> listPublicRooms() {
        return chatRoomRepository.findByIsPrivateFalseAndRoomType(ChatRoom.RoomType.GROUP_CHAT);
    }
}