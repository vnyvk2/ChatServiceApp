package com.example.chatservice.repository;

import com.example.chatservice.domain.RoomMembership;
import com.example.chatservice.domain.RoomMembership.RoomMembershipId;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RoomMembershipRepository extends JpaRepository<RoomMembership, RoomMembershipId> {
    List<RoomMembership> findByUser_Id(Long userId);
    List<RoomMembership> findByRoom_Id(Long roomId);
    boolean existsByRoom_IdAndUser_Id(Long roomId, Long userId);
}


