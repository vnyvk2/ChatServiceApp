package com.example.chatservice.repository;

import com.example.chatservice.domain.ChatRoom;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface ChatRoomRepository extends JpaRepository<ChatRoom, Long> {
    Optional<ChatRoom> findByName(String name);

    List<ChatRoom> findByIsPrivateFalse();
    List<ChatRoom> findByIsPrivateFalseAndRoomType(ChatRoom.RoomType roomType);
    Optional<ChatRoom> findByNameAndRoomType(String name, ChatRoom.RoomType roomType);
}