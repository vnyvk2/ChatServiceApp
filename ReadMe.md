# 🗨️ Chat Service Pro
A high-performance, real-time messaging engine built with Spring Boot 3.3 and MongoDB. Designed for scalability, security, and seamless user experiences.

[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.3.0-brightgreen.svg)](https://spring.io/projects/spring-boot)
[![MongoDB](https://img.shields.io/badge/MongoDB-NoSQL-blue.svg)](https://www.mongodb.com/)
[![WebSocket](https://img.shields.io/badge/WebSocket-STOMP-orange.svg)](https://spring.io/guides/gs/messaging-stomp-websocket/)

---

## ✨ Primary Features

- **🚀 Real-time Communication**: Lightning-fast message delivery using WebSocket & STOMP protocol.
- **💬 Versatile Chat Modes**:
  - **Group Chats**: Create public or private rooms for community discussions.
  - **Direct Messaging (DM)**: Secure one-on-one private conversations.
- **🔍 Advanced User Discovery**: Find users instantly via **Phone Number** or **Username**.
- **🔒 Enterprise-Grade Security**:
  - Stateless **JWT-based** authentication.
  - RBAC (Role-Based Access Control) for room management.
  - AES-256 encryption support for sensitive data.
- **📊 Real-time Presence**: Active status tracking (Online, Away, Offline) with "Last Seen" timestamps.
- **🛠️ Self-Documenting API**: Integrated **Swagger/OpenAPI** UI for effortless developer onboarding.
- **📦 Persistent Storage**: Distributed NoSQL architecture using **MongoDB** for high-volume message history.

---

## 🛠️ Technology Stack

### Backend Architecture
- **Java 17** (LTS) - Core language
- **Spring Boot 3.3.0** - Core framework
- **Spring Data MongoDB** - Scalable NoSQL persistence
- **Spring Security** - JWT & OAuth2-ready security layer
- **WebSocket & SockJS** - Real-time full-duplex communication
- **Lombok** - Boilerplate reduction
- **Maven** - Dependency & build lifecycle management

### Frontend Implementation
- **Vanilla JS (ES6+)** - High-performance reactive client
- **HTML5 & CSS3** - Modern, responsive UI/UX
- **Stomp.js** - WebSocket client library
- **SockJS-client** - WebSocket fallback support

---

## 🚀 Getting Started

### Prerequisites
- **Java 17** or higher
- **MongoDB 6.0+** (Local or Atlas)
- **Maven 3.8+**

### 1. Project Setup
```bash
# Clone the repository
git clone https://github.com/vnyvk2/ChatServiceApp.git
cd chat-service-app/chat-service-app/chat-service-app
```

### 2. Configuration
Ensure your `src/main/resources/application.properties` is configured correctly:
```properties
server.port=8081

# MongoDB Connection
spring.data.mongodb.uri=mongodb://localhost:27017/chatservice

# JWT Settings
app.jwt.secret=your_strong_base64_secret_here
app.jwt.expirationMs=86400000
```

### 3. Build & Launch
```bash
# Build the application
mvn clean install

# Run the service
mvn spring-boot:run
```

---

## 📂 Project Structure

```text
com.example.chatservice
├── config/          # Security, WebSocket, and Bean configurations
├── Controller/      # REST API Endpoints (Auth, User, Room, Message)
├── Dto/             # Data Transfer Objects (Request/Response)
├── Model/           # MongoDB Document Entities (User, Message, ChatRoom)
├── repository/      # Spring Data MongoDB Repositories
├── service/         # Business Logic & Orchestration
└── websocket/       # STOMP Event Handlers
```

---

## 📡 API Nodes

### Public Endpoints
- `POST /api/auth/signup` - Register new identity
- `POST /api/auth/signin` - Authenticate & receive JWT

### Private Endpoints (JWT Required)
| Feature | Endpoint | Description |
| :--- | :--- | :--- |
| **Rooms** | `GET /api/rooms/available` | List all public group chats |
| **DMs** | `POST /api/rooms/direct-message` | Initialize private conversation |
| **Users** | `GET /api/users/search` | Search for connections |
| **Data** | `GET /api/data` | Generic CRUD data management |

### WebSocket Channels
- **Connection**: `/ws`
- **Topic**: `/topic/rooms/{roomId}/messages` (Subscribe for messages)
- **Events**: `/topic/rooms/{roomId}/events` (Subscribe for join/leave events)

---

## 📖 Documentation
Once the server is running, explore the interactive API docs at:
👉 [http://localhost:8081/swagger-ui/index.html](http://localhost:8081/swagger-ui/index.html)

---

## 🤝 Support & Contribution
Developed by **Vinay (vny.vk2@gmail.com)**.  
For any issues or enhancements, please open a PR or contact support.

**Build with ❤️ using Spring Boot & MongoDB**

