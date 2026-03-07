package com.example.chatservice.repository;

import com.example.chatservice.domain.DataEntity;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface DataRepository extends MongoRepository<DataEntity, String> {
}
