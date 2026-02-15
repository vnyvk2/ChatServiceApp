package com.example.chatservice.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.DBRef;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document(collection = "room_memberships")
@CompoundIndex(name = "uk_room_user", def = "{'roomId': 1, 'userId': 1}", unique = true)
@Data
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
public class RoomMembership {

    @Id
    @EqualsAndHashCode.Include
    private String id;

    @DBRef
    @JsonIgnoreProperties({ "createdBy", "createdAt", "updatedAt" })
    private ChatRoom room;

    @Indexed
    private String roomId;

    @DBRef
    @JsonIgnoreProperties({ "passwordHash", "roles", "email", "lastSeenAt", "createdAt", "updatedAt" })
    private User user;

    @Indexed
    private String userId;

    private Role role = Role.MEMBER;

    private boolean isActive = true;

    @CreatedDate
    private Instant joinedAt;

    private Instant leftAt;

    public enum Role {
        ADMIN, MODERATOR, MEMBER
    }

    public void setRoom(ChatRoom room) {
        this.room = room;
        if (room != null) {
            this.roomId = room.getId();
        }
    }

    public ChatRoom getRoom() {
        return room;
    }

    public void setUser(User user) {
        this.user = user;
        if (user != null) {
            this.userId = user.getId();
        }
    }

    public User getUser() {
        return user;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getId() {
        return id;
    }

    public void setRole(Role role) {
        this.role = role;
    }

    public Role getRole() {
        return role;
    }

    public void setActive(boolean isActive) {
        this.isActive = isActive;
    }

    public boolean isActive() {
        return isActive;
    }

    public void setJoinedAt(Instant joinedAt) {
        this.joinedAt = joinedAt;
    }

    public Instant getJoinedAt() {
        return joinedAt;
    }

    public void setLeftAt(Instant leftAt) {
        this.leftAt = leftAt;
    }

    public Instant getLeftAt() {
        return leftAt;
    }
}