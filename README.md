# 🌌 ChillSpace - Spring Boot (Placement Project)

**ChillSpace** is a modern, real-time chat application built with a robust Spring Boot backend and a sleek, glassmorphic frontend. It features **Sparky ⚡**, an advanced AI assistant capable of interacting with the application's data via Function Calling (MCP).

![Status](https://img.shields.io/badge/Status-Active_Development-success?style=for-the-badge)
![Tech](https://img.shields.io/badge/Tech-Spring_Boot_%7C_WebSockets_%7C_MySQL_%7C_Gemini_AI-blueviolet?style=for-the-badge)

## ✨ Key Features

### 🚀 **Completed & Live**
- **Authentication System**
  - Secure Login & Registration with JWT.
  - Custom Avatar generation (Initials) & User Roles (Admin, Moderator, User).
  - **Security:** Credential protection via `.env` files.

- **Real-Time Messaging**
  - **WebSocket Integration:** Instant message delivery.
  - **Live Status:** Real-time Online/Offline user tracking (synced with Database).
  - **File Sharing:** Upload and share files/images in chat.
  - **Message History:** Persistent chat history via MySQL.

- **🤖 Sparky - The AI Assistant**
  - **Personality:** Friendly, context-aware companion.
  - **Memory:** Remembers conversation history for natural multi-turn chats.
  - **MCP (Function Calling):**
    - `get_users`: Sparky knows who is online/offline in real-time.
    - `get_files`: Sparky can list recent shared files.
    - `get_messages`: Sparky can read chat history to answer questions about past conversations.
  - **Knowledge Base:** Can read & answer questions from PDF documents stored in the `knowledge/` folder.

- **UI/UX Design**
  - **Theme:** "Deep Dark" aesthetic with Glassmorphism.
  - **Responsive:** Optimized layouts (Compact/75% zoom style).
  - **Visuals:** Animated backgrounds, smooth transitions, and premium styling.

### 🚧 **In Progress / To Do**
- [ ] **Private Messaging:** (Currently Global Group Chat only).
- [ ] **Advanced Moderation:** AI-powered toxic message filtering.
- [ ] **Supabase Integration:** fully offloading file storage to Supabase Cloud.
- [ ] **Voice/Video Calls:** WebRTC integration.
- [ ] **Mobile Responsive:** Further optimizations for mobile devices.

---

## 🛠️ Tech Stack

- **Backend:** Java 17, Spring Boot 3.2.3
- **Database:** MySQL 8.0, Hibernate/JPA
- **AI Engine:** Google Gemini Pro (via REST API)
- **Frontend:** HTML5, CSS3 (Variables + Flexbox/Grid), Vanilla JavaScript
- **Real-time:** Spring WebSocket (STOMP Protocol)
- **Build Tool:** Maven

---

## ⚙️ Setup & Installation

### 1. Prerequisites
- Java 17 SDK
- Maven
- MySQL Server

### 2. Configuration
Create a `.env` file in the project root:

```properties
# Database
DB_URL=jdbc:mysql://localhost:3306/chill_space_db?useSSL=false
DB_USERNAME=root
DB_PASSWORD=root

# AI & Cloud
GEMINI_API_KEY=your_gemini_key_here
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
```

### 3. Running the App
```bash
mvn spring-boot:run
```
Access the app at: `http://localhost:9195`

---

## 📂 Knowledge Base (RAG)
To feed Sparky information about you or the project:
1. Place PDF files in the `knowledge/` folder.
2. Restart the server.
3. Ask Sparky: *"What does the document say about [topic]?"*

---
*Created with ❤️ by Tamizharasan*
