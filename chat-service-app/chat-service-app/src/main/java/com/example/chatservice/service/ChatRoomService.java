package com.example.chatservice.service;

import com.example.chatservice.domain.ChatRoom;
import com.example.chatservice.domain.RoomMembership;
import com.example.chatservice.domain.User;
import com.example.chatservice.repository.ChatRoomRepository;
import com.example.chatservice.repository.RoomMembershipRepository;
import com.example.chatservice.repository.UserRepository;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Service;

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
        membership.setActive(true);
        membershipRepository.save(membership);

        return room;
    }

    public ChatRoom createDirectMessage(User user1, User user2) {
        // Check if DM already exists — use sorted IDs for consistency
        String id1 = user1.getId();
        String id2 = user2.getId();
        String roomName = "DM_" + (id1.compareTo(id2) < 0 ? id1 + "_" + id2 : id2 + "_" + id1);
        Optional<ChatRoom> existing = chatRoomRepository.findByNameAndRoomType(roomName,
                ChatRoom.RoomType.DIRECT_MESSAGE);

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
        membership1.setActive(true);
        membershipRepository.save(membership1);

        RoomMembership membership2 = new RoomMembership();
        membership2.setRoom(dmRoom);
        membership2.setUser(user2);
        membership2.setRole(RoomMembership.Role.MEMBER);
        membership2.setActive(true);
        membershipRepository.save(membership2);

        return dmRoom;
    }

    public RoomMembership addMember(@NonNull String roomId, @NonNull String userId) {
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
        membership.setRoom(room);
        membership.setUser(user);
        membership.setRole(RoomMembership.Role.MEMBER);
        membership.setActive(true);
        return membershipRepository.save(membership);
    }

    public void removeMember(String roomId, String userId) {
        Optional<RoomMembership> membershipOpt = membershipRepository.findByRoomIdAndUserId(roomId, userId);
        if (membershipOpt.isPresent()) {
            RoomMembership membership = membershipOpt.get();
            membership.setActive(false);
            membership.setLeftAt(Instant.now());
            membershipRepository.save(membership);
        }
    }

    public List<RoomMembership> listMembershipsForUser(String userId) {
        return membershipRepository.findByUserIdAndIsActiveTrue(userId);
    }

    public List<RoomMembership> getRoomMembers(String roomId) {
        return membershipRepository.findByRoomIdAndIsActiveTrue(roomId);
    }

    public List<ChatRoom> listPublicRooms() {
        return chatRoomRepository.findByIsPrivateFalseAndRoomType(ChatRoom.RoomType.GROUP_CHAT);
    }

    public List<ChatRoom> listAllPublicRooms() {
        return chatRoomRepository.findByIsPrivateFalse();
    }

    public Optional<ChatRoom> findRoomById(@NonNull String roomId) {
        return chatRoomRepository.findById(roomId);
    }

    public Optional<ChatRoom> findRoomByName(String name) {
        return chatRoomRepository.findByName(name);
    }

    public boolean isUserMemberOfRoom(String userId, String roomId) {
        return membershipRepository.existsByRoomIdAndUserId(roomId, userId);
    }

    public boolean isUserActiveMemberOfRoom(String userId, String roomId) {
        Optional<RoomMembership> membership = membershipRepository.findByRoomIdAndUserId(roomId, userId);
        return membership.isPresent() && membership.get().isActive();
    }

    public void updateMemberRole(String roomId, String userId, RoomMembership.Role newRole) {
        Optional<RoomMembership> membershipOpt = membershipRepository.findByRoomIdAndUserId(roomId, userId);
        if (membershipOpt.isPresent()) {
            RoomMembership membership = membershipOpt.get();
            membership.setRole(newRole);
            membershipRepository.save(membership);
        } else {
            throw new RuntimeException("Membership not found");
        }
    }

    public void deleteRoom(@NonNull String roomId) {
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

    public ChatRoom updateRoom(@NonNull String roomId, String name, String description, boolean isPrivate) {
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

    public long getRoomMemberCount(String roomId) {
        return membershipRepository.findByRoomIdAndIsActiveTrue(roomId).size();
    }

    public List<User> getActiveUsersInRoom(String roomId) {
        return membershipRepository.findByRoomIdAndIsActiveTrue(roomId)
                .stream()
                .map(RoomMembership::getUser)
                .filter(user -> user.getStatus() == User.UserStatus.ONLINE)
                .toList();
    }

    public boolean canUserAccessRoom(@NonNull String userId, @NonNull String roomId) {
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

    public Optional<RoomMembership> getMembership(String userId, String roomId) {
        return membershipRepository.findByRoomIdAndUserId(roomId, userId);
    }

    public boolean isUserRoomAdmin(String userId, String roomId) {
        Optional<RoomMembership> membership = membershipRepository.findByRoomIdAndUserId(roomId, userId);
        return membership.isPresent() &&
                membership.get().isActive() &&
                membership.get().getRole() == RoomMembership.Role.ADMIN;
    }

    public List<ChatRoom> getUserOwnedRooms(String userId) {
        return chatRoomRepository.findAll().stream()
                .filter(room -> room.getCreatedBy() != null && room.getCreatedBy().getId().equals(userId))
                .toList();
    }
}