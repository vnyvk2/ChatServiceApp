package com.example.chatservice.service;

import com.example.chatservice.Model.ChatRoom;
import com.example.chatservice.Model.Message;
import com.example.chatservice.Model.Message.MessageReceipt;
import com.example.chatservice.Model.Message.MessageStatus;
import com.example.chatservice.Model.RoomMembership;
import com.example.chatservice.Model.User;
import com.example.chatservice.repository.ChatRoomRepository;
import com.example.chatservice.repository.MessageRepository;
import com.example.chatservice.repository.RoomMembershipRepository;
import com.example.chatservice.repository.UserRepository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
public class MessageService {

    private final MessageRepository messageRepository;
    private final UserRepository userRepository;
    private final ChatRoomRepository chatRoomRepository;
    private final RoomMembershipRepository membershipRepository;
    private final CryptoService cryptoService;

    public MessageService(MessageRepository messageRepository,
            UserRepository userRepository,
            ChatRoomRepository chatRoomRepository,
            RoomMembershipRepository membershipRepository,
            CryptoService cryptoService) {
        this.messageRepository = messageRepository;
        this.userRepository = userRepository;
        this.chatRoomRepository = chatRoomRepository;
        this.membershipRepository = membershipRepository;
        this.cryptoService = cryptoService;
    }

    public Message saveEncrypted(String roomId, String senderUsername, String content) {
        System.out.println("MessageService.saveEncrypted called for room " + roomId + " by " + senderUsername);
        User sender = userRepository.findByUsername(senderUsername)
                .orElseThrow(() -> new RuntimeException("User not found"));
        ChatRoom room = chatRoomRepository.findById(roomId)
                .orElseThrow(() -> new RuntimeException("Room not found"));

        System.out.println("Encrypting content...");
        String encryptedContent = cryptoService.encrypt(content);
        System.out.println("Content encrypted.");

        Message message = new Message();
        message.setRoom(room);
        message.setSender(sender);
        message.setEncryptedContent(encryptedContent);
        message.setMessageType(Message.MessageType.TEXT);
        message.setStatus(MessageStatus.SENT);

        // Initialize receipts for all room members except the sender
        // Auto-mark DELIVERED for members who are currently ONLINE
        List<RoomMembership> members = membershipRepository.findByRoomIdAndIsActiveTrue(roomId);
        List<MessageReceipt> receipts = new ArrayList<>();
        Instant now = Instant.now();
        for (RoomMembership membership : members) {
            User member = membership.getUser();
            if (!member.getId().equals(sender.getId())) {
                MessageReceipt receipt = new MessageReceipt(member.getId(), member.getUsername(), member.getDisplayName());
                // If the member is online, auto-mark as DELIVERED
                if (member.getStatus() == User.UserStatus.ONLINE) {
                    receipt.setStatus(MessageStatus.DELIVERED);
                    receipt.setDeliveredAt(now);
                }
                receipts.add(receipt);
            }
        }
        message.setReceipts(receipts);
        message.recalculateStatus();

        System.out.println("Saving message entity with " + receipts.size() + " receipts...");
        return messageRepository.save(message);
    }

    public Message editMessage(String messageId, String userId, String newContent) {
        Message message = messageRepository.findById(messageId)
                .orElseThrow(() -> new RuntimeException("Message not found"));
        
        if (!message.getSender().getId().equals(userId)) {
            throw new RuntimeException("You can only edit your own messages");
        }

        if (Instant.now().isAfter(message.getCreatedAt().plusSeconds(300))) {
            throw new RuntimeException("Messages can only be edited within 5 minutes of sending");
        }

        message.setEncryptedContent(cryptoService.encrypt(newContent));
        message.setEditedAt(Instant.now());
        return messageRepository.save(message);
    }

    /**
     * Marks all messages in a room as DELIVERED for the given user.
     * Returns the list of updated message IDs whose overall status changed.
     */
    public List<String> markAsDelivered(String roomId, String userId) {
        List<Message> messages = messageRepository
                .findByRoomIdAndReceiptUserIdAndReceiptStatus(roomId, userId, "SENT");
        List<String> updatedIds = new ArrayList<>();
        Instant now = Instant.now();

        for (Message message : messages) {
            boolean changed = false;
            for (MessageReceipt receipt : message.getReceipts()) {
                if (receipt.getUserId().equals(userId) && receipt.getStatus() == MessageStatus.SENT) {
                    receipt.setStatus(MessageStatus.DELIVERED);
                    receipt.setDeliveredAt(now);
                    changed = true;
                }
            }
            if (changed) {
                MessageStatus oldStatus = message.getStatus();
                message.recalculateStatus();
                messageRepository.save(message);
                if (message.getStatus() != oldStatus) {
                    updatedIds.add(message.getId());
                }
            }
        }
        return updatedIds;
    }

    /**
     * Marks all pending SENT messages across ALL rooms as DELIVERED for the given user.
     * Called when a user logs in / connects.
     */
    public List<String[]> markAllAsDeliveredForUser(String userId) {
        List<RoomMembership> memberships = membershipRepository.findByUserIdAndIsActiveTrue(userId);
        List<String[]> results = new ArrayList<>();

        for (RoomMembership membership : memberships) {
            String roomId = membership.getRoomId();
            List<String> updated = markAsDelivered(roomId, userId);
            if (!updated.isEmpty()) {
                results.add(new String[]{roomId, String.join(",", updated)});
            }
        }
        return results;
    }

    /**
     * Marks all messages in a room as SEEN for the given user.
     * Returns the list of updated message IDs whose overall status changed.
     */
    public List<String> markAsSeen(String roomId, String userId) {
        // First mark any SENT as DELIVERED, then as SEEN
        List<Message> sentMessages = messageRepository
                .findByRoomIdAndReceiptUserIdAndReceiptStatus(roomId, userId, "SENT");
        List<Message> deliveredMessages = messageRepository
                .findByRoomIdAndReceiptUserIdAndReceiptStatus(roomId, userId, "DELIVERED");

        List<Message> allMessages = new ArrayList<>(sentMessages);
        allMessages.addAll(deliveredMessages);

        List<String> updatedIds = new ArrayList<>();
        Instant now = Instant.now();

        for (Message message : allMessages) {
            boolean changed = false;
            for (MessageReceipt receipt : message.getReceipts()) {
                if (receipt.getUserId().equals(userId)) {
                    if (receipt.getStatus() == MessageStatus.SENT) {
                        receipt.setDeliveredAt(now);
                    }
                    if (receipt.getStatus() != MessageStatus.SEEN) {
                        receipt.setStatus(MessageStatus.SEEN);
                        receipt.setSeenAt(now);
                        changed = true;
                    }
                }
            }
            if (changed) {
                MessageStatus oldStatus = message.getStatus();
                message.recalculateStatus();
                messageRepository.save(message);
                if (message.getStatus() != oldStatus) {
                    updatedIds.add(message.getId());
                }
            }
        }
        return updatedIds;
    }

    /**
     * Get per-member receipt details for a specific message.
     */
    public List<MessageReceipt> getReceipts(String messageId) {
        Message message = messageRepository.findById(messageId)
                .orElseThrow(() -> new RuntimeException("Message not found"));
        return message.getReceipts();
    }

    public List<Message> getRecentMessages(String roomId, String userId, int limit) {
        Pageable pageable = PageRequest.of(0, limit, Sort.by("createdAt").descending());
        return messageRepository.findByRoomIdAndDeletedForUsersNotContainingOrderByCreatedAtDesc(roomId, userId, pageable);
    }

    public List<Message> getAllMessagesInRoom(String roomId) {
        return messageRepository.findByRoomIdOrderByCreatedAtAsc(roomId);
    }

    public String decryptMessage(Message message) {
        return cryptoService.decrypt(message.getEncryptedContent());
    }

    public Optional<Message> findById(String messageId) {
        return messageRepository.findById(messageId);
    }

    public void deleteMessage(String messageId) {
        messageRepository.deleteById(messageId);
    }

    public void deleteMessageForMe(String messageId, String userId) {
        Message message = messageRepository.findById(messageId)
                .orElseThrow(() -> new RuntimeException("Message not found"));
        
        if (message.getDeletedForUsers() == null) {
            message.setDeletedForUsers(new ArrayList<>());
        }
        if (!message.getDeletedForUsers().contains(userId)) {
            message.getDeletedForUsers().add(userId);
            messageRepository.save(message);
        }
    }

    public void deleteAllMessagesInRoom(String roomId) {
        messageRepository.deleteByRoomId(roomId);
    }

    public long getMessageCountInRoom(String roomId) {
        return messageRepository.countByRoomId(roomId);
    }

    // --------- Pagination method ---------

    /**
     * Returns a page of messages for a room. Sorted by createdAt descending by
     * default. Filers out messages the user has deleted for themselves.
     */
    public Page<Message> getMessages(String roomId, String userId, int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return messageRepository.findByRoomIdAndDeletedForUsersNotContaining(roomId, userId, pageable);
    }

    /**
     * Decrypt raw cipher text (used by controller /decrypt endpoint).
     */
    public String decrypt(String cipher) {
        try {
            return cryptoService.decrypt(cipher);
        } catch (Exception e) {
            System.err.println("Failed to decrypt message: " + e.getMessage());
            return "[Encrypted Message]"; // Fallback instead of failing the request
        }
    }
}
