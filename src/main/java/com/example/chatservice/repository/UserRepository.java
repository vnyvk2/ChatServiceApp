package com.example.chatservice.repository;

import com.example.chatservice.Model.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends MongoRepository<User, String> {
    Optional<User> findByUsername(String username);

    Optional<User> findByEmail(String email);

    Optional<User> findByPhoneNumber(String phoneNumber);

    Page<User> findByUsernameContainingIgnoreCase(String username, Pageable pageable);

    Page<User> findByEmailContainingIgnoreCase(String email, Pageable pageable);

    Page<User> findByPhoneNumberContainingIgnoreCase(String phoneNumber, Pageable pageable);

    boolean existsByUsername(String username);

    boolean existsByEmail(String email);

    boolean existsByPhoneNumber(String phoneNumber);

    List<User> findByStatus(User.UserStatus status);

    void deleteByUsername(String username);
}