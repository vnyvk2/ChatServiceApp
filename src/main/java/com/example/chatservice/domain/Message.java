package com.example.chatservice.domain;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

@Entity
@Table(name = "messages", indexes = {
        @Index(name = "idx_messages_room_created", columnList = "room_id, createdAt"),
        @Index(name = "idx_messages_sender_created", columnList = "sender_id, createdAt")
})
public class Message {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "room_id", nullable = false)
    private ChatRoom room;

    @ManyToOne(optional = false)
    @JoinColumn(name = "sender_id", nullable = false)
    private User sender;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String cipherText;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public ChatRoom getRoom() { return room; }
    public void setRoom(ChatRoom room) { this.room = room; }

    public User getSender() { return sender; }
    public void setSender(User sender) { this.sender = sender; }

    public String getCipherText() { return cipherText; }
    public void setCipherText(String cipherText) { this.cipherText = cipherText; }

    public Instant getCreatedAt() { return createdAt; }
}


