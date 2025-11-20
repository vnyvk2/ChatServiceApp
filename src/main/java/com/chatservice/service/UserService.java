package com.chatservice.service;

import com.chatservice.model.User;
import com.chatservice.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
@Transactional
public class UserService {
    @Autowired
    private UserRepository userRepository;

    public List<User> getAllUsers() {
        return userRepository.findAll();
    }

    public Optional<User> getUserById(Long id) {
        return userRepository.findById(id);
    }

    public Optional<User> getUserByUsername(String username) {
        return userRepository.findByUsername(username);
    }

    public List<User> getOnlineUsers() {
        return userRepository.findAllOnlineUsers();
    }

    public List<User> searchUsers(String keyword) {
        return userRepository.searchByUsername(keyword);
    }

    public User setUserOnlineStatus(String username, Boolean online) {
        Optional<User> userOpt = userRepository.findByUsername(username);
        if (userOpt.isPresent()) {
            User user = userOpt.get();
            user.setIsOnline(online);
            user.setLastSeen(LocalDateTime.now());
            return userRepository.save(user);
        }
        return null;
    }

    public void updateLastSeen(String username) {
        Optional<User> userOpt = userRepository.findByUsername(username);
        if (userOpt.isPresent()) {
            User user = userOpt.get();
            user.setLastSeen(LocalDateTime.now());
            userRepository.save(user);
        }
    }
}
