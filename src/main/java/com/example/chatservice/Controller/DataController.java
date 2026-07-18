package com.example.chatservice.Controller;

import com.example.chatservice.Model.DataEntity;
import com.example.chatservice.Dto.request.DataRequest;
import com.example.chatservice.Dto.response.DataResponse;
import com.example.chatservice.service.DataService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/data")
@Tag(name = "Data Management", description = "Endpoints for generic data CRUD operations")
public class DataController {

    private final DataService dataService;

    public DataController(DataService dataService) {
        this.dataService = dataService;
    }

    @GetMapping
    @Operation(summary = "Get all data", description = "Retrieves a list of all data entries.")
    public ResponseEntity<List<DataResponse>> getAllData() {
        List<DataResponse> responses = dataService.getAllData().stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
        return ResponseEntity.ok(responses);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get data by ID", description = "Retrieves a specific data entry by its ID.")
    public ResponseEntity<DataResponse> getDataById(@PathVariable String id) {
        return dataService.getDataById(id)
                .map(this::mapToResponse)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    @Operation(summary = "Create data", description = "Creates a new data entry.")
    public ResponseEntity<DataResponse> createData(@Valid @RequestBody DataRequest request) {
        DataEntity createdData = dataService.createData(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(mapToResponse(createdData));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update data", description = "Updates an existing data entry by its ID.")
    public ResponseEntity<DataResponse> updateData(@PathVariable String id, @Valid @RequestBody DataRequest request) {
        try {
            DataEntity updatedData = dataService.updateData(id, request);
            return ResponseEntity.ok(mapToResponse(updatedData));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete data", description = "Deletes a specific data entry by its ID.")
    public ResponseEntity<Void> deleteData(@PathVariable String id) {
        try {
            dataService.deleteData(id);
            return ResponseEntity.noContent().build();
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    private DataResponse mapToResponse(DataEntity entity) {
        return DataResponse.builder()
                .id(entity.getId())
                .title(entity.getTitle())
                .content(entity.getContent())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }
}
