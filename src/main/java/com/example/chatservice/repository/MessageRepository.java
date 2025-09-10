package com.example.chatservice.repository;

import com.example.chatservice.domain.Message;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MessageRepository extends JpaRepository<Message, Long> {
    List<Message> findByRoom_IdOrderByCreatedAtDesc(Long roomId);
    List<Message> findByRoom_IdOrderByCreatedAtAsc(Long roomId);
    List<Message> findByRoom_IdOrderByCreatedAtDesc(Long roomId, Pageable pageable);

    @Query("SELECT COUNT(m) FROM Message m WHERE m.room.id = :roomId")
    long countByRoom_Id(Long roomId);

    @Query("SELECT m FROM Message m WHERE m.room.id = :roomId ORDER BY m.createdAt DESC")
    List<Message> findRecentMessagesByRoomId(Long roomId, Pageable pageable);
}