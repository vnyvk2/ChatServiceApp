package com.example.chatservice.domain;

import lombok.Data;
import lombok.EqualsAndHashCode;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.DBRef;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document(collection = "messages")
@CompoundIndex(name = "idx_room_created", def = "{'roomId': 1, 'createdAt': -1}")
@Data
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
public class Message {

    @Id
    @EqualsAndHashCode.Include
    private String id;

    @DBRef
    private ChatRoom room;

    @Indexed
    private String roomId;

    @DBRef
    private User sender;

    @Indexed
    private String senderId;

    private String encryptedContent;

    private MessageType messageType = MessageType.TEXT;

    @CreatedDate
    private Instant createdAt;

    public enum MessageType {
        TEXT, IMAGE, FILE, SYSTEM
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public ChatRoom getRoom() {
        return room;
    }

    public void setRoom(ChatRoom room) {
        this.room = room;
        if (room != null) {
            this.roomId = room.getId();
        }
    }

    public User getSender() {
        return sender;
    }

    public void setSender(User sender) {
        this.sender = sender;
        if (sender != null) {
            this.senderId = sender.getId();
        }
    }

    public String getEncryptedContent() {
        return encryptedContent;
    }

    public void setEncryptedContent(String encryptedContent) {
        this.encryptedContent = encryptedContent;
    }

    public MessageType getMessageType() {
        return messageType;
    }

    public void setMessageType(MessageType messageType) {
        this.messageType = messageType;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}