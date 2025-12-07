package com.example.chatservice.service;

import com.example.chatservice.domain.ChatRoom;
import com.example.chatservice.domain.RoomMembership;
import com.example.chatservice.domain.User;
import com.example.chatservice.repository.ChatRoomRepository;
import com.example.chatservice.repository.RoomMembershipRepository;
import com.example.chatservice.repository.UserRepository;
import org.springframework.lang.NonNull;
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
        membership.getId().setRoomId(room.getId());
        membership.getId().setUserId(creator.getId());
        membership.setRoom(room);
        membership.setUser(creator);
        membership.setRole(RoomMembership.Role.ADMIN);
        membership.setActive(true);
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
        membership1.getId().setRoomId(dmRoom.getId());
        membership1.getId().setUserId(user1.getId());
        membership1.setRoom(dmRoom);
        membership1.setUser(user1);
        membership1.setRole(RoomMembership.Role.MEMBER);
        membership1.setActive(true);
        membershipRepository.save(membership1);

        RoomMembership membership2 = new RoomMembership();
        membership2.getId().setRoomId(dmRoom.getId());
        membership2.getId().setUserId(user2.getId());
        membership2.setRoom(dmRoom);
        membership2.setUser(user2);
        membership2.setRole(RoomMembership.Role.MEMBER);
        membership2.setActive(true);
        membershipRepository.save(membership2);

        return dmRoom;
    }

    @Transactional
    public RoomMembership addMember(@NonNull Long roomId, @NonNull Long userId) {
        ChatRoom room = chatRoomRepository.findById(roomId)
                .orElseThrow(() -> new RuntimeException("Room not found"));
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        // Check if membership already exists
        Optional<RoomMembership> existing = membershipRepository.findByRoomIdAndUserId(roomId, userId);
        if (existing.isPresent()) {
            RoomMembership membership = existing.get();
            if (!membership.isActive()) {
                // Reactivate membership
                membership.setActive(true);
                membership.setLeftAt(null);
                return membershipRepository.save(membership);
            }
            return membership; // Already active member
        }

        // Create new membership
        RoomMembership membership = new RoomMembership();
        membership.getId().setRoomId(roomId);
        membership.getId().setUserId(userId);
        membership.setRoom(room);
        membership.setUser(user);
        membership.setRole(RoomMembership.Role.MEMBER);
        membership.setActive(true);
        return membershipRepository.save(membership);
    }

    @Transactional
    public void removeMember(Long roomId, Long userId) {
        Optional<RoomMembership> membershipOpt = membershipRepository.findByRoomIdAndUserId(roomId, userId);
        if (membershipOpt.isPresent()) {
            RoomMembership membership = membershipOpt.get();
            membership.setActive(false);
            membership.setLeftAt(Instant.now());
            membershipRepository.save(membership);
        }
    }

    @Transactional(readOnly = true)
    public List<RoomMembership> listMembershipsForUser(Long userId) {
        return membershipRepository.findByUserIdAndIsActiveTrue(userId);
    }

    @Transactional(readOnly = true)
    public List<RoomMembership> getRoomMembers(Long roomId) {
        return membershipRepository.findByRoomIdAndIsActiveTrue(roomId);
    }

    @Transactional(readOnly = true)
    public List<ChatRoom> listPublicRooms() {
        return chatRoomRepository.findByIsPrivateFalseAndRoomType(ChatRoom.RoomType.GROUP_CHAT);
    }

    @Transactional(readOnly = true)
    public List<ChatRoom> listAllPublicRooms() {
        return chatRoomRepository.findByIsPrivateFalse();
    }

    @Transactional(readOnly = true)
    public Optional<ChatRoom> findRoomById(@NonNull Long roomId) {
        return chatRoomRepository.findById(roomId);
    }

    @Transactional(readOnly = true)
    public Optional<ChatRoom> findRoomByName(String name) {
        return chatRoomRepository.findByName(name);
    }

    @Transactional(readOnly = true)
    public boolean isUserMemberOfRoom(Long userId, Long roomId) {
        return membershipRepository.existsByRoom_IdAndUser_Id(roomId, userId);
    }

    @Transactional(readOnly = true)
    public boolean isUserActiveMemberOfRoom(Long userId, Long roomId) {
        Optional<RoomMembership> membership = membershipRepository.findByRoomIdAndUserId(roomId, userId);
        return membership.isPresent() && membership.get().isActive();
    }

    @Transactional
    public void updateMemberRole(Long roomId, Long userId, RoomMembership.Role newRole) {
        Optional<RoomMembership> membershipOpt = membershipRepository.findByRoomIdAndUserId(roomId, userId);
        if (membershipOpt.isPresent()) {
            RoomMembership membership = membershipOpt.get();
            membership.setRole(newRole);
            membershipRepository.save(membership);
        } else {
            throw new RuntimeException("Membership not found");
        }
    }

    @Transactional
    public void deleteRoom(@NonNull Long roomId) {
        // First, deactivate all memberships
        List<RoomMembership> memberships = membershipRepository.findByRoomIdAndIsActiveTrue(roomId);
        for (RoomMembership membership : memberships) {
            membership.setActive(false);
            membership.setLeftAt(Instant.now());
        }
        membershipRepository.saveAll(memberships);

        // Then delete the room
        chatRoomRepository.deleteById(roomId);
    }

    @Transactional
    public ChatRoom updateRoom(@NonNull Long roomId, String name, String description, boolean isPrivate) {
        ChatRoom room = chatRoomRepository.findById(roomId)
                .orElseThrow(() -> new RuntimeException("Room not found"));

        if (name != null && !name.trim().isEmpty()) {
            room.setName(name.trim());
        }
        if (description != null) {
            room.setDescription(description.trim());
        }
        room.setPrivate(isPrivate);

        return chatRoomRepository.save(room);
    }

    @Transactional(readOnly = true)
    public long getRoomMemberCount(Long roomId) {
        return membershipRepository.findByRoomIdAndIsActiveTrue(roomId).size();
    }

    @Transactional(readOnly = true)
    public List<User> getActiveUsersInRoom(Long roomId) {
        return membershipRepository.findByRoomIdAndIsActiveTrue(roomId)
                .stream()
                .map(RoomMembership::getUser)
                .filter(user -> user.getStatus() == User.UserStatus.ONLINE)
                .toList();
    }

    @Transactional(readOnly = true)
    public boolean canUserAccessRoom(@NonNull Long userId, @NonNull Long roomId) {
        Optional<ChatRoom> roomOpt = chatRoomRepository.findById(roomId);
        if (roomOpt.isEmpty()) {
            return false;
        }

        ChatRoom room = roomOpt.get();

        // If room is public, anyone can access
        if (!room.isPrivate()) {
            return true;
        }

        // If room is private, user must be a member
        return isUserActiveMemberOfRoom(userId, roomId);
    }

    @Transactional(readOnly = true)
    public Optional<RoomMembership> getMembership(Long userId, Long roomId) {
        return membershipRepository.findByRoomIdAndUserId(roomId, userId);
    }

    @Transactional(readOnly = true)
    public boolean isUserRoomAdmin(Long userId, Long roomId) {
        Optional<RoomMembership> membership = membershipRepository.findByRoomIdAndUserId(roomId, userId);
        return membership.isPresent() &&
                membership.get().isActive() &&
                membership.get().getRole() == RoomMembership.Role.ADMIN;
    }

    @Transactional(readOnly = true)
    public List<ChatRoom> getUserOwnedRooms(Long userId) {
        return chatRoomRepository.findAll().stream()
                .filter(room -> room.getCreatedBy() != null && room.getCreatedBy().getId().equals(userId))
                .toList();
    }
}