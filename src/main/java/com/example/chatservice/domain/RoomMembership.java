package com.example.chatservice.domain;

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
        @UniqueConstraint(name = "uk_room_user", columnNames = {"room_id", "user_id"})
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
    private ChatRoom room;

    @ManyToOne(optional = false)
    @MapsId("userId")
    @JoinColumn(name = "user_id", nullable = false)
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

    // Custom setter methods to maintain composite key consistency
    public void setRoom(ChatRoom room) {
        this.room = room;
        if (room != null && this.id != null) {
            this.id.setRoomId(room.getId());
        }
    }

    public void setUser(User user) {
        this.user = user;
        if (user != null && this.id != null) {
            this.id.setUserId(user.getId());
        }
    }

    @Embeddable
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class RoomMembershipId implements Serializable {
        @Column(name = "room_id")
        private Long roomId;

        @Column(name = "user_id")
        private Long userId;
    }
}