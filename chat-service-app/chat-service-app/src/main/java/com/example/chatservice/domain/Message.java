package com.example.chatservice.domain;

import jakarta.persistence.*;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

@Entity
@Table(name = "messages", indexes = {
        @Index(name = "idx_messages_room_created", columnList = "room_id, createdAt"),
        @Index(name = "idx_messages_sender", columnList = "sender_id")
})
@Data
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
public class Message {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @EqualsAndHashCode.Include
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "room_id", nullable = false)
    private ChatRoom room;

    @ManyToOne(optional = false)
    @JoinColumn(name = "sender_id", nullable = false)
    private User sender;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String encryptedContent;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private MessageType messageType = MessageType.TEXT;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    public enum MessageType {
        TEXT, IMAGE, FILE, SYSTEM
    }

    public Long getId() {
        return id;
    }

    public ChatRoom getRoom() {
        return room;
    }

    public User getSender() {
        return sender;
    }

    public String getEncryptedContent() {
        return encryptedContent;
    }

    public MessageType getMessageType() {
        return messageType;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public void setRoom(ChatRoom room) {
        this.room = room;
    }

    public void setSender(User sender) {
        this.sender = sender;
    }

    public void setEncryptedContent(String encryptedContent) {
        this.encryptedContent = encryptedContent;
    }

    public void setMessageType(MessageType messageType) {
        this.messageType = messageType;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}