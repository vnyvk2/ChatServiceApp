package com.example.chatservice.domain;

import jakarta.persistence.*;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

@Entity
@Table(name = "chat_rooms", indexes = {
        @Index(name = "idx_chat_rooms_name", columnList = "name"),
        @Index(name = "idx_chat_rooms_type", columnList = "roomType")
})
@Data
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
public class ChatRoom {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @EqualsAndHashCode.Include
    private Long id;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(length = 500)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private RoomType roomType = RoomType.GROUP_CHAT;

    @Column(nullable = false)
    private boolean isPrivate = false;

    @ManyToOne
    @JoinColumn(name = "created_by")
    private User createdBy;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(nullable = false)
    private Instant updatedAt;

    public enum RoomType {
        GROUP_CHAT,
        DIRECT_MESSAGE,
        BROADCAST
    }
}