# RSCORD 

🦀 **Modern Discord Alternative** built with **Rust** and **Tauri**

A high-performance, secure, and lightweight desktop communication platform featuring real-time messaging, voice channels, and advanced permission systems.

## ✨ Key Features

- 🚀 **Blazing Fast**: Rust backend with Axum framework
- 🖥️ **Native Desktop**: Tauri-based client with minimal resource usage  
- ⚡ **Real-time Messaging**: Redis PubSub for instant message delivery
- 🔐 **Advanced Security**: JWT authentication with Argon2 password hashing
- 📁 **File Sharing**: S3-compatible storage with automatic image optimization
- 👥 **Role-Based Permissions**: Granular channel and server permission system
- 🎙️ **Voice Support**: WebRTC signaling for voice channels
- 🌐 **Self-Hostable**: Complete Docker setup for easy deployment

## 🏗️ Architecture

**Microservices Design:**
- `gateway/` - API Gateway with WebSocket handling
- `auth-service/` - JWT authentication and user management  
- `chat-service/` - Messages, channels, and guilds
- `voice-service/` - WebRTC signaling and voice coordination
- `file-service/` - File uploads with S3-compatible storage
- `presence-service/` - User online/offline status tracking

**Tech Stack:**
- **Backend**: Rust (Axum, tokio, Redis, MongoDB)
- **Frontend**: React + TypeScript (Tauri desktop app)
- **Database**: MongoDB with Redis for caching and PubSub
- **Storage**: MinIO (S3-compatible) for files and media
- **Deployment**: Docker Compose with production-ready configuration

## 🚦 Current Status

✅ **Production Ready Features:**
- User authentication and registration
- Real-time text messaging with broadcasting
- Guild/server creation and management  
- Advanced role and permission system
- File uploads with automatic optimization
- User presence (online/offline) tracking
- Rate limiting and security measures

⚠️ **In Development:**
- Voice/video calling (WebRTC SFU)
- Mobile and web clients
- Bot API and integrations
- Advanced moderation tools

## 🛠️ Quick Start

