# Chat Application

A full-stack real-time chat application built with Spring Boot, WebSocket, JSP, and MySQL. Features user authentication, private messaging, chat rooms, and real-time notifications.

## 🚀 Features

- **Real-time Messaging**: Instant message delivery using WebSocket and STOMP protocol
- **User Authentication**: Secure JWT-based authentication with Spring Security
- **Chat Rooms**: Create and join public chat rooms for group conversations
- **Private Messaging**: Send direct messages to other users
- **Online Status**: See who's currently online
- **User Search**: Find and connect with other users
- **Responsive Design**: Works seamlessly across desktop, tablet, and mobile devices
- **Message History**: Persistent message storage with MySQL database
- **Notifications**: Real-time in-app and browser notifications for new messages
- **Secure**: Password encryption and JWT token-based authentication

## 🛠️ Technology Stack

### Backend
- **Java 17** - Programming language
- **Spring Boot 3.1.5** - Application framework
- **Spring Security** - Authentication and authorization
- **Spring Data JPA** - Database access layer
- **WebSocket & STOMP** - Real-time communication
- **JWT** - Token-based authentication
- **MySQL** - Database
- **Maven** - Dependency management

### Frontend
- **JSP** - Server-side rendering
- **HTML5 & CSS3** - UI structure and styling
- **JavaScript (ES6+)** - Client-side functionality
- **SockJS & STOMP.js** - WebSocket client
- **Font Awesome** - Icons

## 📋 Prerequisites

Before running the application, ensure you have:

- **Java 17** or higher installed
- **MySQL 8.0** or higher running
- **Maven 3.8** or higher installed
- **Git** for cloning the repository

## 🔧 Installation & Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd chat-service
```

### 2. Database Setup

1. Start MySQL server
2. Create a database (the application will create it automatically):

```sql
CREATE DATABASE chatdb CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

3. Create a MySQL user (optional, or use root):

```sql
CREATE USER 'chatuser'@'localhost' IDENTIFIED BY 'password';
GRANT ALL PRIVILEGES ON chatdb.* TO 'chatuser'@'localhost';
FLUSH PRIVILEGES;
```

### 3. Configure Database Connection

Update the database configuration in `src/main/resources/application.properties`:

```properties
spring.datasource.url=jdbc:mysql://localhost:3306/chatdb?createDatabaseIfNotExist=true&useSSL=false&allowPublicKeyRetrieval=true
spring.datasource.username=root
spring.datasource.password=your_mysql_password
```

### 4. Build and Run

```bash
# Build the application
mvn clean install

# Run the application
mvn spring-boot:run
```

Or run directly with Java:

```bash
mvn clean package
java -jar target/chat-service-0.0.1-SNAPSHOT.jar
```

### 5. Access the Application

Open your web browser and navigate to:
```
http://localhost:8080
```

## 📱 Usage Guide

### Getting Started

1. **Register**: Create a new account with username, email, and password
2. **Login**: Sign in with your credentials
3. **Join Rooms**: Browse and join public chat rooms
4. **Private Chat**: Click on online users to start private conversations
5. **Create Rooms**: Create new chat rooms for group discussions

### Features Overview

#### Authentication
- Secure registration and login
- JWT token-based session management
- Password encryption with BCrypt

#### Chat Rooms
- Join existing public chat rooms
- Create new chat rooms with descriptions
- Real-time message synchronization
- Member count and room information

#### Private Messaging
- Direct one-on-one conversations
- Real-time message delivery
- Message history persistence

#### User Management
- Online/offline status indicators
- User search functionality
- Profile information display

## 🏗️ Architecture

### Backend Architecture

```
src/main/java/com/eazybyts/chatservice/
├── config/          # Configuration classes
├── controller/      # REST controllers
├── model/           # JPA entities
├── repository/      # Data access layer
├── security/        # Security configuration
├── service/         # Business logic
└── payload/         # DTOs and request/response objects
```

### Database Schema

#### Users Table
- User authentication and profile information
- Online status tracking
- Role-based access control

#### Messages Table
- Message content and metadata
- Sender and recipient information
- Timestamps and read status

#### Chat Rooms Table
- Room information and settings
- Creator and member management
- Privacy settings

#### Roles Table
- User role definitions
- Permission management

### Frontend Architecture

```
src/main/webapp/WEB-INF/jsp/    # JSP templates
src/main/resources/static/
├── css/        # Stylesheets
└── js/         # JavaScript files
```

## 🔒 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Password Encryption**: BCrypt hashing for user passwords
- **CORS Configuration**: Controlled cross-origin resource sharing
- **Input Validation**: Server-side validation for all inputs
- **SQL Injection Prevention**: JPA/Hibernate parameter binding
- **XSS Protection**: HTML escaping in frontend
- **Session Management**: Stateless JWT-based sessions

## 🚀 API Endpoints

### Authentication
- `POST /api/auth/signup` - User registration
- `POST /api/auth/signin` - User login
- `POST /api/auth/signout` - User logout

### Chat Rooms
- `GET /api/chatrooms/public` - Get public chat rooms
- `POST /api/chatrooms/create` - Create new chat room
- `POST /api/chatrooms/{id}/join` - Join chat room
- `POST /api/chatrooms/{id}/leave` - Leave chat room
- `GET /api/chatrooms/{id}/messages` - Get room messages

### Messages
- `GET /api/messages/private/{username}` - Get private messages
- `GET /api/messages/unread` - Get unread messages
- `GET /api/messages/unread/count` - Get unread message count
- `POST /api/messages/mark-read/{id}` - Mark message as read

### Users
- `GET /api/users/me` - Get current user info
- `GET /api/users/online` - Get online users
- `GET /api/users/search` - Search users

### WebSocket Endpoints
- `/ws` - WebSocket connection endpoint
- `/app/chat.sendMessage` - Send room message
- `/app/chat.sendPrivateMessage` - Send private message
- `/app/chat.addUser` - Join room notification

## 🧪 Testing

Run the tests using Maven:

```bash
mvn test
```

## 📦 Deployment

### Production Configuration

1. Update `application.properties` for production:

```properties
server.port=8080
spring.datasource.url=jdbc:mysql://prod-db-host:3306/chatdb
spring.jpa.hibernate.ddl-auto=validate
app.jwtSecret=your-production-jwt-secret-key-here
```

2. Build production JAR:

```bash
mvn clean package -Pprod
```

3. Deploy with environment variables:

```bash
java -jar -Dspring.profiles.active=prod target/chat-service-0.0.1-SNAPSHOT.jar
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/new-feature`)
3. Commit your changes (`git commit -m 'Add new feature'`)
4. Push to the branch (`git push origin feature/new-feature`)
5. Open a Pull Request



## 🙋‍♂️ Support

For support and questions:
- Email: vny.vk2@gmail.com

## 🏆 Project Highlights

This chat application demonstrates proficiency in:
- **Full-stack development** with Java Spring Boot and modern frontend
- **Real-time communication** using WebSocket and STOMP
- **Database design** and JPA/Hibernate ORM
- **Security implementation** with JWT and Spring Security
- **RESTful API design** following best practices
- **Responsive UI/UX design** with modern CSS
- **Git version control** and project structure

Built as part of the EazyByts Full Stack Development Program Week 1 Project.

---

**Thank You 💬**
