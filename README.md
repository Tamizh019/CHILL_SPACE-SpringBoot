# 🌌 ChillSpace - Spring Boot (Placement Project)

**ChillSpace** is a modern, real-time chat application built with a robust Spring Boot backend and a sleek, glassmorphic frontend. It features **Sparky ⚡**, an advanced AI assistant capable of interacting with the application's data via Function Calling (MCP).

> **🔴 LIVE DEMO:** [https://chill-space-springboot.onrender.com](https://chill-space-springboot.onrender.com)
> _(Note: Hosted on Render Free Tier. It may take 1-2 minutes to wake up from sleep mode, so please be patient!)_

![Status](https://img.shields.io/badge/Status-Active_Development-success?style=for-the-badge)
![Tech](https://img.shields.io/badge/Tech-Spring_Boot_%7C_Docker_%7C_MySQL_%7C_Gemini_AI-blueviolet?style=for-the-badge)

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

### 🚧 **Future Plans**
- [ ] **Private Messaging:** (Currently Global Group Chat only).
- [ ] **Advanced Moderation:** AI-powered toxic message filtering.
- [ ] **Supabase Integration:** fully offloading file storage to Supabase Cloud.
- [ ] **Voice/Video Calls:** WebRTC integration.
- [ ] **Mobile Responsive:** Further optimizations for mobile devices.

---

## 🛠️ Tech Stack

- **Backend:** Java 17, Spring Boot 3.2.3
- **Database:** MySQL 8.0 (Local) / Aiven Cloud MySQL (Production)
- **Containerization:** Docker
- **AI Engine:** Google Gemini Pro (via REST API)
- **Frontend:** HTML5, CSS3 (Variables + Flexbox/Grid), Vanilla JavaScript
- **Real-time:** Spring WebSocket (STOMP Protocol)
- **Build Tool:** Maven

---

## ⚙️ Setup & Installation

### 1. Prerequisites
- Java 17 SDK
- Maven
- MySQL Server (for local dev) OR Aiven Account
- Docker (Optional)

### 2. Configuration
Create a `.env` file in the project root. This project supports seamless switching between Local and Cloud databases.

```properties
# Server
PORT=9195

# Secrets
JWT_SECRET=your_jwt_secret
GEMINI_API_KEY=your_gemini_key
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key

# --- DATABASE CONFIGURATION ---

# 1. DEVELOPMENT (Localhost) - Default
DB_URL=jdbc:mysql://localhost:3306/chill_space_db?useSSL=false&serverTimezone=UTC&allowPublicKeyRetrieval=true
DB_USERNAME=root
DB_PASSWORD=local_password

# 2. PRODUCTION (Aiven Cloud) - (Uncomment in application.properties to use)
DB_URL2=jdbc:mysql://your-aiven-url:18358/defaultdb?sslMode=VERIFY_CA&trustCertificateKeyStoreUrl=classpath:truststore.jks&trustCertificateKeyStorePassword=password
DB_USERNAME2=avnadmin
DB_PASSWORD2=aiven_password
```

### 3. Running the App

**Option A: Using Maven (Local)**
```bash
mvn spring-boot:run
```

**Option B: Using Docker (Production/Test)**
```bash
# Build the image
docker build -t chillspace-backend .

# Run the container
docker run -p 9195:9196 --env-file .env chillspace-backend
```
Access the app at: `http://localhost:9195`

## ☁️ Deployment

This project includes a `Dockerfile` and is ready for deployment on platforms like **Railway** or **Render**.

1.  **Push to GitHub**: Ensure `src/main/resources/truststore.jks` and `Dockerfile` are in your repo.
2.  **Deploy on Railway**: Connect your GitHub repo.
3.  **Variables**: Add your `.env` variables (DB_URL2, DB_USERNAME2, etc.) to the Railway dashboard.
4.  **Enjoy**: Your app will automatically connect to Aiven Cloud MySQL via SSL.

---

## 📂 Knowledge Base (RAG)
To feed Sparky information about you or the project:
1. Place PDF files in the `knowledge/` folder.
2. Restart the server.
3. Ask Sparky: *"What does the document say about [topic]?"*

---
*Created with ❤️ by Tamizharasan*
