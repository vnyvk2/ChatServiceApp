package com.example.chatservice.websocket;

import com.example.chatservice.security.JwtService;
import org.springframework.lang.NonNull;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.stereotype.Component;

@Component
public class WebSocketJwtInterceptor implements ChannelInterceptor {

    private final JwtService jwtService;
    private final UserDetailsService userDetailsService;

    public WebSocketJwtInterceptor(JwtService jwtService, UserDetailsService userDetailsService) {
        this.jwtService = jwtService;
        this.userDetailsService = userDetailsService;
    }

    @Override
    public Message<?> preSend(@NonNull Message<?> message, @NonNull MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);

        if (accessor != null) {
            if (StompCommand.CONNECT.equals(accessor.getCommand())) {
                String authToken = accessor.getFirstNativeHeader("Authorization");
                System.out.println("🔌 WebSocket CONNECT request received");
                if (authToken != null && authToken.startsWith("Bearer ")) {
                    String token = authToken.substring(7);
                    try {
                        String username = jwtService.extractUsername(token);
                        System.out.println("👤 Extracted username from token: " + username);

                        if (username != null && jwtService.isTokenValid(token, username)) {
                            UserDetails userDetails = userDetailsService.loadUserByUsername(username);
                            UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                                    userDetails, null, userDetails.getAuthorities());

                            // Set in SecurityContext
                            SecurityContextHolder.getContext().setAuthentication(authentication);

                            // Set as user principal
                            accessor.setUser(authentication);

                            // Store in session attributes for later retrieval
                            accessor.getSessionAttributes().put("SPRING_SECURITY_CONTEXT", authentication);

                            System.out.println("✅ WebSocket authentication successful for user: " + username);
                        } else {
                            System.err.println("❌ Token validation failed for user: " + username);
                        }
                    } catch (Exception e) {
                        // Log the exception but don't break the connection
                        System.err.println("❌ JWT validation failed: " + e.getMessage());
                        e.printStackTrace();
                    }
                } else {
                    System.err.println("⚠️ No valid Authorization header found in WebSocket CONNECT request");
                }
            } else if (StompCommand.SEND.equals(accessor.getCommand())) {
                System.out.println("📨 WebSocket SEND frame received");
                System.out.println("📍 Destination: " + accessor.getDestination());

                // Try to get user from accessor first
                if (accessor.getUser() != null) {
                    System.out.println("👤 User from accessor: " + accessor.getUser().getName());
                    if (accessor.getUser() instanceof UsernamePasswordAuthenticationToken) {
                        SecurityContextHolder.getContext().setAuthentication(
                                (UsernamePasswordAuthenticationToken) accessor.getUser());
                    }
                } else {
                    // Try to retrieve from session attributes
                    Object auth = accessor.getSessionAttributes().get("SPRING_SECURITY_CONTEXT");
                    if (auth instanceof UsernamePasswordAuthenticationToken) {
                        UsernamePasswordAuthenticationToken authentication = (UsernamePasswordAuthenticationToken) auth;
                        System.out.println("👤 User from session: " + authentication.getName());

                        // Set it back to accessor and SecurityContext
                        accessor.setUser(authentication);
                        SecurityContextHolder.getContext().setAuthentication(authentication);
                    } else {
                        System.err.println("❌ No authentication found in session attributes!");
                    }
                }
            }
        }
        return message;
    }
}