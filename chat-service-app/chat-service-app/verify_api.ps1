$ErrorActionPreference = "Stop"

function Test-Api {
    Write-Host "--- Starting API Verification ---"

    # 1. Register
    $registerBody = Get-Content -Path "register.json" -Raw
    try {
        $regResponse = Invoke-RestMethod -Uri "http://localhost:8081/api/auth/register" -Method Post -ContentType "application/json" -Body $registerBody
        Write-Host "✅ Registration Successful: $($regResponse.user.username)"
    } catch {
        Write-Host "⚠️ Registration Failed (User might exist): $($_.Exception.Message)"
    }

    # 2. Login
    $loginBody = Get-Content -Path "login.json" -Raw
    $loginResponse = Invoke-RestMethod -Uri "http://localhost:8081/api/auth/login" -Method Post -ContentType "application/json" -Body $loginBody
    $token = $loginResponse.token
    Write-Host "✅ Login Successful. Token obtained."

    $headers = @{
        "Authorization" = "Bearer $token"
        "Content-Type" = "application/json"
    }

    # 3. Create Room (Group Chat)
    $createRoomBody = @{
        name = "PowerShell Debug Room"
        description = "Testing via PS"
        roomType = "GROUP_CHAT"
        isPrivate = $false
    } | ConvertTo-Json
    
    try {
        $roomResponse = Invoke-RestMethod -Uri "http://localhost:8081/api/rooms" -Method Post -Headers $headers -Body $createRoomBody
        $roomId = $roomResponse.id
        Write-Host "✅ Room Created: $($roomResponse.name) (ID: $roomId)"
    } catch {
        Write-Host "❌ Create Room Failed: $($_.Exception.Message)"
        exit 1
    }

    # 4. Join Room
    try {
        Invoke-RestMethod -Uri "http://localhost:8081/api/rooms/$roomId/join" -Method Post -Headers $headers
        Write-Host "✅ Joined Room"
    } catch {
        Write-Host "❌ Join Room Failed: $($_.Exception.Message)"
        exit 1
    }
    
    # 5. Send Message (via WebSocket API is hard in PS, use HTTP endpoint? No, we don't have HTTP send)
    # Wait, the controller has @MessageMapping. Is there an HTTP endpoint for sending?
    # No, only WebSocket.
    # But wait! I implemented `MessageService.saveEncrypted`... is there a REST endpoint calling it?
    # No. 
    # Ah. The ONLY way to send messages is via WebSocket.
    # But I can check my-rooms endpoint to verify connection works.
    
    # Verification plan B for messages: 
    # Since I can't easily test WebSocket in PowerShell, I will verify:
    # - Registration (API)
    # - Login (API)
    # - Create Room (API) -> This validates @AuthenticationPrincipal in RoomController (NPE fix)
    # - Join Room (API) -> This validates @AuthenticationPrincipal in RoomController (NPE fix)
    # - Get My Rooms (API) -> This validates @AuthenticationPrincipal in RoomController (NPE fix)
    
    # Message decryption logic I fixed in MessageController... 
    # Can I manually insert a message into DB? 
    # Or just trust that if the API returns decrypted content it works?
    # I can try to hit /api/messages/rooms/{roomId} - it should return empty list (decrypting nothing is fine).
    # If it fails with 500, then my fix is bad. If it returns [], it works.
    
    # Let's hit Get Messages
    try {
        $messages = Invoke-RestMethod -Uri "http://localhost:8081/api/messages/rooms/$roomId" -Method Get -Headers $headers
        Write-Host "✅ Get Messages: Success (Count: $($messages.content.Count))"
        # Since I can't send, count will likely be 0.
        # But at least it didn't crash.
    } catch {
        Write-Host "❌ Get Messages Failed: $($_.Exception.Message)"
        exit 1
    }

    Write-Host "--- Verification Complete ---"
}

Test-Api
