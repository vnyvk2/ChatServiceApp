package com.example.chatservice.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.io.Serializable;
import java.time.Instant;

@Entity
@Table(name = "room_memberships", uniqueConstraints = {
        @UniqueConstraint(name = "uk_room_user", columnNames = { "room_id", "user_id" })
})
@Data
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
public class RoomMembership {

    @EmbeddedId
    @EqualsAndHashCode.Include
    private RoomMembershipId id = new RoomMembershipId();

    @ManyToOne(optional = false)
    @MapsId("roomId")
    @JoinColumn(name = "room_id", nullable = false)
    @JsonIgnoreProperties({ "createdBy", "createdAt", "updatedAt" })
    private ChatRoom room;

    @ManyToOne(optional = false)
    @MapsId("userId")
    @JoinColumn(name = "user_id", nullable = false)
    @JsonIgnoreProperties({ "passwordHash", "roles", "email", "lastSeenAt", "createdAt", "updatedAt" })
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Role role = Role.MEMBER;

    @Column(nullable = false)
    private boolean isActive = true;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant joinedAt;

    @Column
    private Instant leftAt;

    public enum Role {
        ADMIN, MODERATOR, MEMBER
    }

    public void setRoom(ChatRoom room) {
        this.room = room;
        if (room != null && this.id != null) {
            this.id.setRoomId(room.getId());
        }
    }

    public ChatRoom getRoom() {
        return room;
    }

    public void setUser(User user) {
        this.user = user;
        if (user != null && this.id != null) {
            this.id.setUserId(user.getId());
        }
    }

    public User getUser() {
        return user;
    }

    public void setId(RoomMembershipId id) {
        this.id = id;
    }

    public RoomMembershipId getId() {
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

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class RoomMembershipId implements Serializable {
        @Column(name = "room_id")
        private Long roomId;

        @Column(name = "user_id")
        private Long userId;

        public Long getRoomId() {
            return roomId;
        }

        public void setRoomId(Long roomId) {
            this.roomId = roomId;
        }

        public Long getUserId() {
            return userId;
        }

        public void setUserId(Long userId) {
            this.userId = userId;
        }
    }
}