package com.example.chatservice.domain;

import jakarta.persistence.*;

import java.io.Serializable;
import java.time.Instant;

@Entity
@Table(name = "room_memberships", uniqueConstraints = {
        @UniqueConstraint(name = "uk_room_user", columnNames = {"room_id", "user_id"})
})
public class RoomMembership {

    @EmbeddedId
    private RoomMembershipId id = new RoomMembershipId();

    @ManyToOne(optional = false)
    @MapsId("roomId")
    @JoinColumn(name = "room_id", nullable = false)
    private ChatRoom room;

    @ManyToOne(optional = false)
    @MapsId("userId")
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false)
    private Instant joinedAt = Instant.now();

    public RoomMembershipId getId() { return id; }
    public void setId(RoomMembershipId id) { this.id = id; }

    public ChatRoom getRoom() { return room; }
    public void setRoom(ChatRoom room) { this.room = room; }

    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }

    public Instant getJoinedAt() { return joinedAt; }
    public void setJoinedAt(Instant joinedAt) { this.joinedAt = joinedAt; }

    @Embeddable
    public static class RoomMembershipId implements Serializable {
        @Column(name = "room_id")
        private Long roomId;
        @Column(name = "user_id")
        private Long userId;

        public Long getRoomId() { return roomId; }
        public void setRoomId(Long roomId) { this.roomId = roomId; }
        public Long getUserId() { return userId; }
        public void setUserId(Long userId) { this.userId = userId; }

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (o == null || getClass() != o.getClass()) return false;
            RoomMembershipId that = (RoomMembershipId) o;
            return java.util.Objects.equals(roomId, that.roomId) &&
                    java.util.Objects.equals(userId, that.userId);
        }

        @Override
        public int hashCode() {
            return java.util.Objects.hash(roomId, userId);
        }
    }
}


