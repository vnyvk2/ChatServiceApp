package com.example.chatservice.repository;

import com.example.chatservice.Model.Message;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
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

    // Find messages in a room where a specific user's receipt has a certain status
    @Query("{'roomId': ?0, 'senderId': {$ne: ?1}, 'receipts': {$elemMatch: {'userId': ?1, 'status': ?2}}}")
    List<Message> findByRoomIdAndReceiptUserIdAndReceiptStatus(String roomId, String userId, String status);

    // Delete all messages in a room
    void deleteByRoomId(String roomId);
}

