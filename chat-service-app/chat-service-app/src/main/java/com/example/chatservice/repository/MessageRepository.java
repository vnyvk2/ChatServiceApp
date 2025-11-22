package com.example.chatservice.repository;

import com.example.chatservice.domain.Message;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MessageRepository extends JpaRepository<Message, Long> {

    // For pagination in MessageService.getMessages()
    Page<Message> findByRoom_Id(Long roomId, Pageable pageable);

    // Used in getRecentMessages()
    List<Message> findByRoom_IdOrderByCreatedAtDesc(Long roomId, Pageable pageable);

    // Used in getAllMessagesInRoom()
    List<Message> findByRoom_IdOrderByCreatedAtAsc(Long roomId);

    // Count messages in a room
    long countByRoom_Id(Long roomId);
}
