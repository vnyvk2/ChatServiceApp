package com.example.chatservice.repository;

import com.example.chatservice.domain.RoomMembership;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RoomMembershipRepository extends MongoRepository<RoomMembership, String> {
    List<RoomMembership> findByUserId(String userId);

    List<RoomMembership> findByRoomId(String roomId);

    boolean existsByRoomIdAndUserId(String roomId, String userId);

    Optional<RoomMembership> findByRoomIdAndUserId(String roomId, String userId);

    List<RoomMembership> findByUserIdAndIsActiveTrue(String userId);

    List<RoomMembership> findByRoomIdAndIsActiveTrue(String roomId);
}