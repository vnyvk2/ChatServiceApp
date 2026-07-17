package com.example.chatservice.Dto.response;

public class UserSummaryResponse {

    private String id;
    private String username;
    private String displayName;
    private String phoneNumber;
    private String status;

    public UserSummaryResponse(String id, String username, String displayName,
            String phoneNumber, String status) {
        this.id = id;
        this.username = username;
        this.displayName = displayName;
        this.phoneNumber = phoneNumber;
        this.status = status;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getDisplayName() {
        return displayName;
    }

    public void setDisplayName(String displayName) {
        this.displayName = displayName;
    }

    public String getPhoneNumber() {
        return phoneNumber;
    }

    public void setPhoneNumber(String phoneNumber) {
        this.phoneNumber = phoneNumber;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }
}
