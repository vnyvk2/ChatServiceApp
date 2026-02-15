package com.example.chatservice.repository;

import com.example.chatservice.domain.Message;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MessageRepository extends MongoRepository<Message, String> {

    // For pagination in MessageService.getMessages()
    Page<Message> findByRoomId(String roomId, Pageable pageable);

    // Used in getRecentMessages()
    List<Message> findByRoomIdOrderByCreatedAtDesc(String roomId, Pageable pageable);

    // Used in getAllMessagesInRoom()
    List<Message> findByRoomIdOrderByCreatedAtAsc(String roomId);

    // Count messages in a room
    long countByRoomId(String roomId);
}
