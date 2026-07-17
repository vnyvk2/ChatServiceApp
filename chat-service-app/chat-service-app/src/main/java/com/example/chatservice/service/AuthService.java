package com.example.chatservice.service;

import com.example.chatservice.Dto.request.RegisterRequest;
import com.example.chatservice.Dto.response.AuthResponse;
import com.example.chatservice.Dto.response.UserSummaryResponse;
import com.example.chatservice.Model.User;
import com.example.chatservice.exception.AuthenticationFailedException;
import com.example.chatservice.security.JwtService;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Optional;

@Service
public class AuthService {

    private final UserService userService;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;

    public AuthService(UserService userService,
            JwtService jwtService,
            AuthenticationManager authenticationManager) {
        this.userService = userService;
        this.jwtService = jwtService;
        this.authenticationManager = authenticationManager;
    }

    /**
     * Registers a new user and returns an AuthResponse with a JWT token.
     */
    public AuthResponse register(RegisterRequest request) {
        String phoneNumber = request.getPhoneNumber() != null && !request.getPhoneNumber().trim().isEmpty()
                ? request.getPhoneNumber().trim()
                : null;

        User user = userService.registerUser(
                request.getUsername(),
                request.getPassword(),
                request.getDisplayName(),
                request.getEmail(),
                phoneNumber);

        String token = jwtService.generateToken(user.getUsername(), new HashMap<>());

        return buildAuthResponse(token, user);
    }

    /**
     * Authenticates a user by username and password, updates status to ONLINE,
     * and returns an AuthResponse with a JWT token.
     */
    public AuthResponse login(String username, String password) {
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(username, password));

        User user = userService.findByUsername(username)
                .orElseThrow(() -> new AuthenticationFailedException("Invalid credentials"));

        userService.updateUserStatus(user.getId(), User.UserStatus.ONLINE);

        String token = jwtService.generateToken(username, new HashMap<>());

        return buildAuthResponse(token, user, User.UserStatus.ONLINE.toString());
    }

    /**
     * Logs out the user by setting their status to OFFLINE.
     */
    public void logout(String username) {
        if (username == null) {
            return;
        }
        User user = userService.findByUsername(username)
                .orElseThrow(() -> new AuthenticationFailedException("User not found"));
        userService.updateUserStatus(user.getId(), User.UserStatus.OFFLINE);
    }

    /**
     * Searches for a user by phone number and returns a UserSummaryResponse.
     */
    public Optional<UserSummaryResponse> searchByPhone(String phoneNumber) {
        return userService.findByPhoneNumber(phoneNumber)
                .map(user -> new UserSummaryResponse(
                        user.getId(),
                        user.getUsername(),
                        user.getDisplayName(),
                        user.getPhoneNumber(),
                        user.getStatus().toString()));
    }

    private AuthResponse buildAuthResponse(String token, User user) {
        return buildAuthResponse(token, user, user.getStatus().toString());
    }

    private AuthResponse buildAuthResponse(String token, User user, String status) {
        AuthResponse.UserInfo userInfo = new AuthResponse.UserInfo(
                user.getId(),
                user.getUsername(),
                user.getDisplayName(),
                user.getEmail(),
                user.getPhoneNumber() != null ? user.getPhoneNumber() : "",
                status);

        return new AuthResponse(token, userInfo);
    }
}
