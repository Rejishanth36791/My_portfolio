-- ============================================================
-- REJISHANTH PORTFOLIO DATABASE SCHEMA
-- Execute this SQL script in MySQL Workbench, phpMyAdmin, or MySQL CLI
-- ============================================================

-- 1. Use Default Database (or Create if not existing)
CREATE DATABASE IF NOT EXISTS defaultdb;
USE defaultdb;

-- 2. Create Contact Messages Table
CREATE TABLE IF NOT EXISTS contact_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL,
    subject VARCHAR(200) DEFAULT 'General Inquiry',
    message TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'unread',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Verify Table Creation
SELECT * FROM contact_messages;
