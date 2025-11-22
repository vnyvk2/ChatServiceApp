package com.example.chatservice.repository;

import com.example.chatservice.domain.RoomMembership;
import com.example.chatservice.domain.RoomMembership.RoomMembershipId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RoomMembershipRepository extends JpaRepository<RoomMembership, RoomMembershipId> {
    List<RoomMembership> findByUser_Id(Long userId);
    List<RoomMembership> findByRoom_Id(Long roomId);
    boolean existsByRoom_IdAndUser_Id(Long roomId, Long userId);

    // Add these missing methods for enhanced functionality
    @Query("SELECT rm FROM RoomMembership rm WHERE rm.id.roomId = :roomId AND rm.id.userId = :userId")
    Optional<RoomMembership> findByRoomIdAndUserId(@Param("roomId") Long roomId, @Param("userId") Long userId);

    @Query("SELECT rm FROM RoomMembership rm WHERE rm.id.userId = :userId AND rm.isActive = true")
    List<RoomMembership> findByUserIdAndIsActiveTrue(@Param("userId") Long userId);

    @Query("SELECT rm FROM RoomMembership rm WHERE rm.id.roomId = :roomId AND rm.isActive = true")
    List<RoomMembership> findByRoomIdAndIsActiveTrue(@Param("roomId") Long roomId);
}