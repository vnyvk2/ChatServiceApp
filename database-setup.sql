-- Chat Service Database Setup Script
-- Run this in MySQL Workbench or command line

-- Create database
CREATE DATABASE IF NOT EXISTS chatdb 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

-- Use the database
USE chatdb;

-- Grant privileges (if needed)
-- GRANT ALL PRIVILEGES ON chatdb.* TO 'root'@'localhost';
-- FLUSH PRIVILEGES;

-- The tables will be created automatically by Hibernate when you run the application
-- because spring.jpa.hibernate.ddl-auto=update is set in application.properties

-- Optional: Insert default roles
-- These will be needed for role-based authentication
INSERT INTO roles (name) VALUES ('ROLE_USER') ON DUPLICATE KEY UPDATE name=name;
INSERT INTO roles (name) VALUES ('ROLE_MODERATOR') ON DUPLICATE KEY UPDATE name=name;
INSERT INTO roles (name) VALUES ('ROLE_ADMIN') ON DUPLICATE KEY UPDATE name=name;
