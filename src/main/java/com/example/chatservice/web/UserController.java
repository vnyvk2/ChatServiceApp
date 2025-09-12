package com.example.chatservice.web;

import com.example.chatservice.service.UserService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/users")
@CrossOrigin(origins = "*")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping("/search")
    public ResponseEntity<?> searchUsers(@RequestParam String query,
                                         @AuthenticationPrincipal UserDetails principal) {
        // Search by username or phone number
        List<Map<String, Object>> results = new ArrayList<>();

        // Search by username
        userService.findByUsername(query).ifPresent(user -> {
            if (!user.getUsername().equals(principal.getUsername())) {
                results.add(Map.of(
                        "username", user.getUsername(),
                        "displayName", user.getDisplayName(),
                        "status", user.getStatus(),
                        "searchType", "username"
                ));
            }
        });

        // Search by phone number if not found by username
        if (results.isEmpty()) {
            userService.findByPhoneNumber(query).ifPresent(user -> {
                if (!user.getUsername().equals(principal.getUsername())) {
                    results.add(Map.of(
                            "username", user.getUsername(),
                            "displayName", user.getDisplayName(),
                            "phoneNumber", user.getPhoneNumber(),
                            "status", user.getStatus(),
                            "searchType", "phone"
                    ));
                }
            });
        }

        return ResponseEntity.ok(results);
    }
}
