package com.example.chatservice.web;

import com.example.chatservice.domain.User;
import com.example.chatservice.repository.UserRepository;
import com.example.chatservice.security.JwtService;
import com.example.chatservice.service.UserService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*")
public class AuthController {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;
    private final UserService userService;

    public AuthController(UserRepository userRepository,
                          PasswordEncoder passwordEncoder,
                          AuthenticationManager authenticationManager,
                          JwtService jwtService,
                          UserService userService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.authenticationManager = authenticationManager;
        this.jwtService = jwtService;
        this.userService = userService;
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody RegisterRequest request) {
        try {
            if (userRepository.existsByUsername(request.username())) {
                return ResponseEntity.badRequest().body(Map.of("error", "Username already taken"));
            }
            if (userRepository.existsByEmail(request.email())) {
                return ResponseEntity.badRequest().body(Map.of("error", "Email already in use"));
            }
            if (request.phoneNumber() != null && !request.phoneNumber().trim().isEmpty() &&
                    userRepository.existsByPhoneNumber(request.phoneNumber())) {
                return ResponseEntity.badRequest().body(Map.of("error", "Phone number already in use"));
            }

            User user = new User();
            user.setUsername(request.username());
            user.setEmail(request.email());
            user.setPhoneNumber(request.phoneNumber() != null && !request.phoneNumber().trim().isEmpty() ?
                    request.phoneNumber().trim() : null);
            user.setDisplayName(request.displayName());
            user.setPasswordHash(passwordEncoder.encode(request.password()));
            user.setStatus(User.UserStatus.OFFLINE);
            userRepository.save(user);

            String token = jwtService.generateToken(user.getUsername(), new HashMap<>());

            Map<String, Object> response = new HashMap<>();
            response.put("token", token);
            response.put("user", Map.of(
                    "id", user.getId(),
                    "username", user.getUsername(),
                    "displayName", user.getDisplayName(),
                    "email", user.getEmail(),
                    "phoneNumber", user.getPhoneNumber() != null ? user.getPhoneNumber() : "",
                    "status", user.getStatus().toString()
            ));

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Registration failed: " + e.getMessage()));
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest request) {
        try {
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(request.username(), request.password())
            );

            User user = userRepository.findByUsername(request.username()).orElseThrow();
            userService.updateUserStatus(user.getId(), User.UserStatus.ONLINE);

            String token = jwtService.generateToken(request.username(), new HashMap<>());

            Map<String, Object> response = new HashMap<>();
            response.put("token", token);
            response.put("user", Map.of(
                    "id", user.getId(),
                    "username", user.getUsername(),
                    "displayName", user.getDisplayName(),
                    "email", user.getEmail(),
                    "phoneNumber", user.getPhoneNumber() != null ? user.getPhoneNumber() : "",
                    "status", User.UserStatus.ONLINE.toString()
            ));

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid credentials"));
        }
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout(@AuthenticationPrincipal UserDetails userDetails) {
        try {
            if (userDetails != null) {
                User user = userRepository.findByUsername(userDetails.getUsername()).orElseThrow();
                userService.updateUserStatus(user.getId(), User.UserStatus.OFFLINE);
            }
            return ResponseEntity.ok(Map.of("message", "Logged out successfully"));
        } catch (Exception e) {
            return ResponseEntity.ok(Map.of("message", "Logged out successfully"));
        }
    }

    @GetMapping("/search-by-phone")
    public ResponseEntity<?> searchByPhone(@RequestParam String phoneNumber) {
        try {
            Optional<User> user = userRepository.findByPhoneNumber(phoneNumber);
            if (user.isPresent()) {
                User foundUser = user.get();
                return ResponseEntity.ok(Map.of(
                        "id", foundUser.getId(),
                        "username", foundUser.getUsername(),
                        "displayName", foundUser.getDisplayName(),
                        "phoneNumber", foundUser.getPhoneNumber(),
                        "status", foundUser.getStatus().toString()
                ));
            }
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Search failed"));
        }
    }

    public record RegisterRequest(
            @NotBlank @Size(min = 3, max = 50) String username,
            @NotBlank @Email String email,
            @Pattern(regexp = "^$|^\\+?[1-9]\\d{1,14}$", message = "Invalid phone number format") String phoneNumber,
            @NotBlank @Size(min = 6, max = 100) String password,
            @NotBlank @Size(min = 1, max = 100) String displayName
    ) {}

    public record LoginRequest(
            @NotBlank String username,
            @NotBlank String password
    ) {}
}