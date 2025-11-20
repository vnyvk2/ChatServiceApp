package com.chatservice.repository;

import com.chatservice.model.ChatRoom;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ChatRoomRepository extends JpaRepository<ChatRoom, Long> {
    Optional<ChatRoom> findByName(String name);
    
    List<ChatRoom> findByIsPublic(Boolean isPublic);
    
    @Query("SELECT c FROM ChatRoom c WHERE c.isPublic = true ORDER BY c.createdAt DESC")
    List<ChatRoom> findAllPublicRooms();
    
    @Query("SELECT c FROM ChatRoom c JOIN c.members m WHERE m.id = :userId")
    List<ChatRoom> findRoomsByUserId(Long userId);
    
    Boolean existsByName(String name);
}
