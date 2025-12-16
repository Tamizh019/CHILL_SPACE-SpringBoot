package com.chillspace.backend.controller;

import com.chillspace.backend.service.GeminiService;
import com.chillspace.backend.repository.MessageRepository;
import com.chillspace.backend.repository.SharedFileRepository;
import com.chillspace.backend.repository.UserRepository;
import com.chillspace.backend.model.Message;
import com.chillspace.backend.model.SharedFile;
import com.chillspace.backend.model.User;
import org.json.JSONArray;
import org.json.JSONObject;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/ai")
@CrossOrigin(origins = "*")
public class AiController {

    private static final Logger logger = LoggerFactory.getLogger(AiController.class);
    private static final int MAX_ITERATIONS = 5; // Prevent infinite loops

    private final GeminiService geminiService;
    private final MessageRepository messageRepository;
    private final SharedFileRepository sharedFileRepository;
    private final UserRepository userRepository;
    private final com.chillspace.backend.service.KnowledgeService knowledgeService;

    public AiController(GeminiService geminiService,
            MessageRepository messageRepository,
            SharedFileRepository sharedFileRepository,
            UserRepository userRepository,
            com.chillspace.backend.service.KnowledgeService knowledgeService) {
        this.geminiService = geminiService;
        this.messageRepository = messageRepository;
        this.sharedFileRepository = sharedFileRepository;
        this.userRepository = userRepository;
        this.knowledgeService = knowledgeService;
    }

    /**
     * Test endpoint
     */
    @GetMapping("/test")
    public ResponseEntity<?> testAI() {
        logger.info("🧪 Testing AI connection...");
        try {
            String testResponse = geminiService.generateResponse(
                    "Say: 'Hello! I'm Sparky with MCP tools!'",
                    "You are Sparky.");
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "response", testResponse));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("success", false, "error", e.getMessage()));
        }
    }

    /**
     * Main chat endpoint with Function Calling (MCP)
     */
    @PostMapping("/chat")
    public ResponseEntity<?> chat(@RequestBody Map<String, Object> payload) {
        long startTime = System.currentTimeMillis();

        String userQuery = (String) payload.get("query");
        if (userQuery == null || userQuery.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "error", "Query cannot be empty"));
        }

        userQuery = userQuery.trim();
        logger.info("💬 AI Query: {}", userQuery.substring(0, Math.min(50, userQuery.length())) + "...");

        try {
            // Build conversation history
            @SuppressWarnings("unchecked")
            List<Map<String, String>> history = (List<Map<String, String>>) payload.get("history");
            String systemContext = buildSystemContext();

            // Build initial contents with history
            JSONArray contents = buildContents(history, userQuery);

            // Function calling loop
            String finalResponse = executeFunctionCallingLoop(contents, systemContext);

            long duration = System.currentTimeMillis() - startTime;
            logger.info("✅ AI response in {}ms", duration);

            return ResponseEntity.ok(Map.of(
                    "success", !finalResponse.startsWith("Error"),
                    "response", finalResponse,
                    "timestamp", LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME),
                    "processingTime", duration + "ms"));

        } catch (Exception e) {
            logger.error("❌ Error: ", e);
            return ResponseEntity.ok(Map.of(
                    "success", false,
                    "response", "Sorry, I'm having trouble: " + e.getMessage()));
        }
    }

    /**
     * Execute function calling loop (like React chatbot's handleFunctionCalls)
     */
    private String executeFunctionCallingLoop(JSONArray contents, String systemContext) {
        for (int i = 0; i < MAX_ITERATIONS; i++) {
            logger.info("🔁 Iteration {}/{}", i + 1, MAX_ITERATIONS);

            Map<String, Object> result = geminiService.generateWithTools(contents, systemContext, true);

            // Check if it's a function call
            if (result.containsKey("functionCall")) {
                @SuppressWarnings("unchecked")
                Map<String, Object> functionCall = (Map<String, Object>) result.get("functionCall");
                String functionName = (String) functionCall.get("name");
                @SuppressWarnings("unchecked")
                Map<String, Object> args = (Map<String, Object>) functionCall.get("args");

                logger.info("🛠️ Executing tool: {}", functionName);

                // Execute the tool
                String toolResult = executeTool(functionName, args);

                // Add model's function call to contents
                JSONObject modelMessage = new JSONObject();
                modelMessage.put("role", "model");
                JSONArray modelParts = new JSONArray();
                modelParts.put(new JSONObject()
                        .put("functionCall", new JSONObject()
                                .put("name", functionName)
                                .put("args", args != null ? new JSONObject(args) : new JSONObject())));
                modelMessage.put("parts", modelParts);
                contents.put(modelMessage);

                // Add function response
                JSONObject functionResponse = new JSONObject();
                functionResponse.put("role", "function");
                JSONArray functionParts = new JSONArray();
                functionParts.put(new JSONObject()
                        .put("functionResponse", new JSONObject()
                                .put("name", functionName)
                                .put("response", new JSONObject().put("result", toolResult))));
                functionResponse.put("parts", functionParts);
                contents.put(functionResponse);

                // Continue loop - let Gemini use the result
                continue;
            }

            // No function call - return text response
            if (result.containsKey("text")) {
                return (String) result.get("text");
            }

            break;
        }

        return "I had trouble formulating a response. Can you rephrase that?";
    }

    /**
     * Execute a tool and return result
     */
    private String executeTool(String name, Map<String, Object> args) {
        try {
            switch (name) {
                case "get_users":
                    return executeGetUsers(args);
                case "get_files":
                    return executeGetFiles(args);
                case "get_messages":
                    return executeGetMessages(args);
                default:
                    return "Unknown tool: " + name;
            }
        } catch (Exception e) {
            logger.error("Tool execution error: ", e);
            return "Error executing tool: " + e.getMessage();
        }
    }

    /**
     * Get users tool implementation
     */
    private String executeGetUsers(Map<String, Object> args) {
        String status = args != null ? (String) args.get("status") : null;
        String username = args != null ? (String) args.get("username") : null;

        List<User> users;

        if (username != null && !username.isEmpty()) {
            // Search by username
            users = userRepository.findByUsername(username)
                    .map(List::of)
                    .orElse(List.of());
        } else if ("online".equalsIgnoreCase(status)) {
            users = userRepository.findAll().stream()
                    .filter(User::isOnline)
                    .collect(Collectors.toList());
        } else if ("offline".equalsIgnoreCase(status)) {
            users = userRepository.findAll().stream()
                    .filter(u -> !u.isOnline())
                    .collect(Collectors.toList());
        } else {
            users = userRepository.findAll();
        }

        if (users.isEmpty()) {
            return "No users found matching the criteria.";
        }

        StringBuilder sb = new StringBuilder();
        sb.append("Found ").append(users.size()).append(" user(s):\n");
        for (User user : users) {
            sb.append("- ").append(user.getUsername())
                    .append(" (").append(user.getRole()).append(")")
                    .append(user.isOnline() ? " 🟢 Online" : " ⚫ Offline")
                    .append(user.isBanned() ? " [BANNED]" : "")
                    .append("\n");
        }
        return sb.toString();
    }

    /**
     * Get files tool implementation
     */
    private String executeGetFiles(Map<String, Object> args) {
        int limit = 5;
        String type = null;

        if (args != null) {
            if (args.get("limit") != null) {
                limit = ((Number) args.get("limit")).intValue();
            }
            type = (String) args.get("type");
        }

        List<SharedFile> files = sharedFileRepository.findAll(
                PageRequest.of(0, limit, Sort.by(Sort.Direction.DESC, "uploadedAt"))).getContent();

        if (type != null && !type.isEmpty()) {
            final String filterType = type.toLowerCase();
            files = files.stream()
                    .filter(f -> f.getContentType() != null &&
                            f.getContentType().toLowerCase().contains(filterType))
                    .collect(Collectors.toList());
        }

        if (files.isEmpty()) {
            return "No files found.";
        }

        StringBuilder sb = new StringBuilder();
        sb.append("Found ").append(files.size()).append(" file(s):\n");
        for (SharedFile file : files) {
            sb.append("- ").append(file.getFilename())
                    .append(" (").append(formatFileSize(file.getFileSize())).append(")")
                    .append(" by ").append(file.getUploadedBy())
                    .append("\n");
        }
        return sb.toString();
    }

    /**
     * Get messages tool implementation
     */
    private String executeGetMessages(Map<String, Object> args) {
        int limit = 10;
        String sender = null;

        if (args != null) {
            if (args.get("limit") != null) {
                limit = ((Number) args.get("limit")).intValue();
            }
            sender = (String) args.get("sender");
        }

        List<Message> messages = messageRepository.findAll(
                PageRequest.of(0, limit, Sort.by(Sort.Direction.DESC, "timestamp"))).getContent();

        if (sender != null && !sender.isEmpty()) {
            final String filterSender = sender.toLowerCase();
            messages = messages.stream()
                    .filter(m -> m.getSender() != null &&
                            m.getSender().toLowerCase().contains(filterSender))
                    .collect(Collectors.toList());
        }

        if (messages.isEmpty()) {
            return "No messages found.";
        }

        StringBuilder sb = new StringBuilder();
        sb.append("Recent ").append(messages.size()).append(" message(s):\n");
        for (Message msg : messages) {
            String content = msg.getContent();
            if (content.length() > 100) {
                content = content.substring(0, 100) + "...";
            }
            sb.append("- [").append(msg.getSender()).append("]: ")
                    .append(content).append("\n");
        }
        return sb.toString();
    }

    /**
     * Build conversation contents for Gemini
     */
    private JSONArray buildContents(List<Map<String, String>> history, String userQuery) {
        JSONArray contents = new JSONArray();

        // Add history
        if (history != null) {
            for (Map<String, String> msg : history) {
                String role = msg.get("role");
                String text = msg.get("text");
                if (role != null && text != null) {
                    JSONObject message = new JSONObject();
                    message.put("role", "user".equals(role) ? "user" : "model");
                    JSONArray parts = new JSONArray();
                    parts.put(new JSONObject().put("text", text));
                    message.put("parts", parts);
                    contents.put(message);
                }
            }
        }

        // Add current query
        JSONObject userMessage = new JSONObject();
        userMessage.put("role", "user");
        JSONArray parts = new JSONArray();
        parts.put(new JSONObject().put("text", userQuery));
        userMessage.put("parts", parts);
        contents.put(userMessage);

        return contents;
    }

    /**
     * Build system context
     */
    private String buildSystemContext() {
        return "You're Sparky ⚡ - a warm, friendly, and helpful AI assistant!\n\n" +
                "YOUR PERSONALITY:\n" +
                "- Be conversational, friendly, and helpful like a supportive friend.\n" +
                "- Use casual language and emojis sparingly to add warmth 😊\n" +
                "- Answer ANY question the user asks - you're a general-purpose assistant.\n" +
                "- For general knowledge questions (science, history, celebrities, etc.), answer directly!\n" +
                "- Be enthusiastic and positive.\n\n" +
                "CHILL SPACE FEATURES (use tools when asked about these):\n" +
                "You have access to tools to query the ChillSpace database:\n" +
                "- get_users: Get user information (online status, roles)\n" +
                "- get_files: Get shared files\n" +
                "- get_messages: Get recent chat messages\n\n" +
                "When users ask about ChillSpace members, users, files, or chat history, USE THE TOOLS!\n" +
                "After getting tool results, give a friendly, natural response.\n\n" +
                "KNOWLEDGE BASE (if available):\n" +
                knowledgeService.getKnowledgeBaseContent();
    }

    /**
     * Format file size
     */
    private String formatFileSize(Long bytes) {
        if (bytes == null)
            return "unknown size";
        if (bytes < 1024)
            return bytes + " B";
        if (bytes < 1024 * 1024)
            return (bytes / 1024) + " KB";
        return (bytes / (1024 * 1024)) + " MB";
    }
}
