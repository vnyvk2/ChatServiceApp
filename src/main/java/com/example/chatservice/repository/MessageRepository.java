package com.example.chatservice.repository;

import com.example.chatservice.domain.Message;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MessageRepository extends JpaRepository<Message, Long> {
    Page<Message> findByRoom_IdOrderByCreatedAtAsc(Long roomId, Pageable pageable);
}


