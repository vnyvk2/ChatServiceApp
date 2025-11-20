package com.chatservice.controller;

import com.chatservice.service.UserService;
import com.chatservice.model.User;
import com.chatservice.security.services.UserDetailsImpl;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/users")
public class UserController {
    @Autowired
    private UserService userService;

    @GetMapping("/me")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> getCurrentUser() {
        UserDetailsImpl userDetails = (UserDetailsImpl) SecurityContextHolder.getContext()
                .getAuthentication().getPrincipal();

        User user = userService.getUserById(userDetails.getId())
                .orElseThrow(() -> new RuntimeException("User not found"));

        Map<String, Object> response = new HashMap<>();
        response.put("id", user.getId());
        response.put("username", user.getUsername());
        response.put("email", user.getEmail());
        response.put("isOnline", user.getIsOnline());

        return ResponseEntity.ok(response);
    }

    @GetMapping("/online")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> getOnlineUsers() {
        List<User> onlineUsers = userService.getOnlineUsers();

        List<Map<String, Object>> userList = onlineUsers.stream()
                .map(user -> {
                    Map<String, Object> userMap = new HashMap<>();
                    userMap.put("id", user.getId());
                    userMap.put("username", user.getUsername());
                    userMap.put("isOnline", user.getIsOnline());
                    userMap.put("lastSeen", user.getLastSeen());
                    return userMap;
                })
                .collect(Collectors.toList());

        return ResponseEntity.ok(userList);
    }

    @GetMapping("/search")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> searchUsers(@RequestParam String keyword) {
        List<User> users = userService.searchUsers(keyword);

        List<Map<String, Object>> userList = users.stream()
                .map(user -> {
                    Map<String, Object> userMap = new HashMap<>();
                    userMap.put("id", user.getId());
                    userMap.put("username", user.getUsername());
                    userMap.put("isOnline", user.getIsOnline());
                    return userMap;
                })
                .collect(Collectors.toList());

        return ResponseEntity.ok(userList);
    }
}
