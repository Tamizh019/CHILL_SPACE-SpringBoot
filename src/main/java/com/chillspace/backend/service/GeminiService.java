package com.chillspace.backend.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.*;
import org.json.JSONArray;
import org.json.JSONObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Map;
import java.util.HashMap;

@Service
public class GeminiService {

    private static final Logger logger = LoggerFactory.getLogger(GeminiService.class);

    @Value("${gemini.api.key}")
    private String apiKey;

    @Value("${gemini.model}")
    private String model;

    private static final String API_URL_TEMPLATE = "https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s";

    /**
     * Generate response with function calling support
     * Returns a Map with either:
     * - "text" -> final response text
     * - "functionCall" -> { "name": "...", "args": {...} }
     */
    public Map<String, Object> generateWithTools(JSONArray contents, String systemContext, boolean includeTools) {
        String url = String.format(API_URL_TEMPLATE, model, apiKey);
        
        logger.info("🤖 Calling Gemini API with model: {} (tools: {})", model, includeTools);

        JSONObject requestBody = new JSONObject();
        requestBody.put("contents", contents);

        // Add system instruction
        JSONObject systemPart = new JSONObject();
        systemPart.put("text", systemContext);
        JSONArray systemParts = new JSONArray();
        systemParts.put(systemPart);
        JSONObject systemInstruction = new JSONObject();
        systemInstruction.put("parts", systemParts);
        requestBody.put("systemInstruction", systemInstruction);

        // Add function declarations if requested
        if (includeTools) {
            requestBody.put("tools", buildToolDeclarations());
        }

        // Add generation config
        JSONObject generationConfig = new JSONObject();
        generationConfig.put("temperature", 0.7);
        generationConfig.put("topP", 0.95);
        generationConfig.put("maxOutputTokens", 2048);
        requestBody.put("generationConfig", generationConfig);

        // Send request
        RestTemplate restTemplate = new RestTemplate();
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<String> entity = new HttpEntity<>(requestBody.toString(), headers);

        try {
            logger.debug("📤 Sending request to Gemini...");
            ResponseEntity<String> response = restTemplate.postForEntity(url, entity, String.class);
            
            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                return parseResponse(response.getBody());
            } else {
                logger.error("❌ Unexpected response status: {}", response.getStatusCode());
                return Map.of("text", "Error: Unexpected response from AI");
            }
            
        } catch (org.springframework.web.client.HttpClientErrorException e) {
            logger.error("❌ HTTP Error: {} - {}", e.getStatusCode(), e.getResponseBodyAsString());
            String errorMsg = "Error: " + e.getStatusCode();
            if (e.getStatusCode() == HttpStatus.NOT_FOUND) {
                errorMsg = "Error: Model not found";
            } else if (e.getStatusCode() == HttpStatus.TOO_MANY_REQUESTS) {
                errorMsg = "Error: Rate limit exceeded";
            }
            return Map.of("text", errorMsg);
            
        } catch (Exception e) {
            logger.error("❌ Unexpected error: ", e);
            return Map.of("text", "Error: " + e.getMessage());
        }
    }

    /**
     * Simple generate (backwards compatible)
     */
    public String generateResponse(String prompt, String systemContext) {
        JSONArray contents = new JSONArray();
        JSONObject userMessage = new JSONObject();
        userMessage.put("role", "user");
        JSONArray parts = new JSONArray();
        parts.put(new JSONObject().put("text", prompt));
        userMessage.put("parts", parts);
        contents.put(userMessage);

        Map<String, Object> result = generateWithTools(contents, systemContext, false);
        return (String) result.getOrDefault("text", "Error: No response");
    }

    /**
     * Build tool/function declarations for Gemini
     */
    private JSONArray buildToolDeclarations() {
        JSONArray tools = new JSONArray();
        JSONObject toolWrapper = new JSONObject();
        JSONArray functionDeclarations = new JSONArray();

        // Tool 1: get_users
        JSONObject getUsersTool = new JSONObject();
        getUsersTool.put("name", "get_users");
        getUsersTool.put("description", "Get information about users in the ChillSpace chat application. Can list all users or filter by online status.");
        JSONObject getUsersParams = new JSONObject();
        getUsersParams.put("type", "OBJECT");
        JSONObject getUsersProps = new JSONObject();
        getUsersProps.put("status", new JSONObject()
            .put("type", "STRING")
            .put("description", "Filter by 'online' or 'offline'. Omit for all users."));
        getUsersProps.put("username", new JSONObject()
            .put("type", "STRING")
            .put("description", "Search for a specific user by username."));
        getUsersParams.put("properties", getUsersProps);
        getUsersTool.put("parameters", getUsersParams);
        functionDeclarations.put(getUsersTool);

        // Tool 2: get_files
        JSONObject getFilesTool = new JSONObject();
        getFilesTool.put("name", "get_files");
        getFilesTool.put("description", "Get a list of files shared in the ChillSpace chat.");
        JSONObject getFilesParams = new JSONObject();
        getFilesParams.put("type", "OBJECT");
        JSONObject getFilesProps = new JSONObject();
        getFilesProps.put("limit", new JSONObject()
            .put("type", "INTEGER")
            .put("description", "Maximum number of files to return. Default is 5."));
        getFilesProps.put("type", new JSONObject()
            .put("type", "STRING")
            .put("description", "Filter by file type like 'image', 'pdf', 'video'."));
        getFilesParams.put("properties", getFilesProps);
        getFilesTool.put("parameters", getFilesParams);
        functionDeclarations.put(getFilesTool);

        // Tool 3: get_messages
        JSONObject getMessagesTool = new JSONObject();
        getMessagesTool.put("name", "get_messages");
        getMessagesTool.put("description", "Get recent chat messages from the group chat.");
        JSONObject getMessagesParams = new JSONObject();
        getMessagesParams.put("type", "OBJECT");
        JSONObject getMessagesProps = new JSONObject();
        getMessagesProps.put("limit", new JSONObject()
            .put("type", "INTEGER")
            .put("description", "Number of messages to return. Default is 10."));
        getMessagesProps.put("sender", new JSONObject()
            .put("type", "STRING")
            .put("description", "Filter messages by sender username."));
        getMessagesParams.put("properties", getMessagesProps);
        getMessagesTool.put("parameters", getMessagesParams);
        functionDeclarations.put(getMessagesTool);

        toolWrapper.put("functionDeclarations", functionDeclarations);
        tools.put(toolWrapper);
        
        logger.debug("🛠️ Built {} tool declarations", functionDeclarations.length());
        return tools;
    }

    /**
     * Parse Gemini response - check for function call or text
     */
    private Map<String, Object> parseResponse(String jsonResponse) {
        try {
            JSONObject root = new JSONObject(jsonResponse);
            
            if (!root.has("candidates") || root.getJSONArray("candidates").length() == 0) {
                logger.error("❌ No candidates in response");
                return Map.of("text", "Error: No response generated");
            }

            JSONObject candidate = root.getJSONArray("candidates").getJSONObject(0);
            JSONObject content = candidate.getJSONObject("content");
            JSONArray parts = content.getJSONArray("parts");
            JSONObject firstPart = parts.getJSONObject(0);

            // Check if it's a function call
            if (firstPart.has("functionCall")) {
                JSONObject functionCall = firstPart.getJSONObject("functionCall");
                String functionName = functionCall.getString("name");
                JSONObject args = functionCall.optJSONObject("args");
                
                logger.info("🛠️ Function call requested: {}", functionName);
                
                Map<String, Object> result = new HashMap<>();
                result.put("functionCall", Map.of(
                    "name", functionName,
                    "args", args != null ? args.toMap() : Map.of()
                ));
                return result;
            }

            // Regular text response
            if (firstPart.has("text")) {
                return Map.of("text", firstPart.getString("text"));
            }

            return Map.of("text", "Error: Unexpected response format");

        } catch (Exception e) {
            logger.error("❌ Error parsing response: ", e);
            return Map.of("text", "Error parsing response: " + e.getMessage());
        }
    }

    /**
     * Test connection
     */
    public boolean testConnection() {
        try {
            String response = generateResponse("Say 'OK'", "Be brief.");
            return response != null && !response.startsWith("Error");
        } catch (Exception e) {
            return false;
        }
    }
}
