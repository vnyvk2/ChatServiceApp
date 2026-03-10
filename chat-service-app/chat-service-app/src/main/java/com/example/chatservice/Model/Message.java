package com.example.chatservice.Model;

import lombok.Data;
import lombok.EqualsAndHashCode;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.DBRef;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

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

    private MessageStatus status = MessageStatus.SENT;

    private List<MessageReceipt> receipts = new ArrayList<>();

    @CreatedDate
    private Instant createdAt;

    public enum MessageType {
        TEXT, IMAGE, FILE, SYSTEM
    }

    public enum MessageStatus {
        SENT, DELIVERED, SEEN
    }

    @Data
    public static class MessageReceipt {
        private String userId;
        private String username;
        private String displayName;
        private MessageStatus status = MessageStatus.SENT;
        private Instant deliveredAt;
        private Instant seenAt;

        public MessageReceipt() {}

        public MessageReceipt(String userId, String username, String displayName) {
            this.userId = userId;
            this.username = username;
            this.displayName = displayName;
            this.status = MessageStatus.SENT;
        }

        public String getUserId() {
            return userId;
        }

        public void setUserId(String userId) {
            this.userId = userId;
        }

        public String getUsername() {
            return username;
        }

        public void setUsername(String username) {
            this.username = username;
        }

        public String getDisplayName() {
            return displayName;
        }

        public void setDisplayName(String displayName) {
            this.displayName = displayName;
        }

        public MessageStatus getStatus() {
            return status;
        }

        public void setStatus(MessageStatus status) {
            this.status = status;
        }

        public Instant getDeliveredAt() {
            return deliveredAt;
        }

        public void setDeliveredAt(Instant deliveredAt) {
            this.deliveredAt = deliveredAt;
        }

        public Instant getSeenAt() {
            return seenAt;
        }

        public void setSeenAt(Instant seenAt) {
            this.seenAt = seenAt;
        }
    }

    /**
     * Recalculates the overall message status based on all receipts.
     * Uses MAX logic: status is the MINIMUM across all receipts
     * (DELIVERED only when ALL are DELIVERED, SEEN only when ALL have SEEN).
     */
    public void recalculateStatus() {
        if (receipts == null || receipts.isEmpty()) {
            this.status = MessageStatus.SENT;
            return;
        }
        MessageStatus minStatus = MessageStatus.SEEN;
        for (MessageReceipt receipt : receipts) {
            if (receipt.getStatus().ordinal() < minStatus.ordinal()) {
                minStatus = receipt.getStatus();
            }
        }
        this.status = minStatus;
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

    public MessageStatus getStatus() {
        return status;
    }

    public void setStatus(MessageStatus status) {
        this.status = status;
    }

    public List<MessageReceipt> getReceipts() {
        return receipts;
    }

    public void setReceipts(List<MessageReceipt> receipts) {
        this.receipts = receipts;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}