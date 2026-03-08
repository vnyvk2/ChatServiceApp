package com.example.chatservice.service;

import com.example.chatservice.Model.DataEntity;
import com.example.chatservice.Dto.request.DataRequest;
import com.example.chatservice.repository.DataRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
public class DataService {

    private final DataRepository dataRepository;

    public DataService(DataRepository dataRepository) {
        this.dataRepository = dataRepository;
    }

    public List<DataEntity> getAllData() {
        return dataRepository.findAll();
    }

    public Optional<DataEntity> getDataById(String id) {
        return dataRepository.findById(id);
    }

    public DataEntity createData(DataRequest request) {
        DataEntity entity = new DataEntity(request.getTitle(), request.getContent());
        return dataRepository.save(entity);
    }

    public DataEntity updateData(String id, DataRequest request) {
        Optional<DataEntity> optionalEntity = dataRepository.findById(id);
        if (optionalEntity.isPresent()) {
            DataEntity entity = optionalEntity.get();
            entity.setTitle(request.getTitle());
            entity.setContent(request.getContent());
            entity.setUpdatedAt(LocalDateTime.now());
            return dataRepository.save(entity);
        } else {
            throw new RuntimeException("DataEntity not found with id: " + id);
        }
    }

    public void deleteData(String id) {
        if (dataRepository.existsById(id)) {
            dataRepository.deleteById(id);
        } else {
            throw new RuntimeException("DataEntity not found with id: " + id);
        }
    }
}
