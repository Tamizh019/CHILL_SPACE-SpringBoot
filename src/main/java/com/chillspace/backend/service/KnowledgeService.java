package com.chillspace.backend.service;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.IOException;
import java.util.Arrays;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Service
public class KnowledgeService {

    private static final Logger logger = LoggerFactory.getLogger(KnowledgeService.class);
    private static final String KNOWLEDGE_DIR = "knowledge"; // Directory in project root

    // Cache to avoid re-parsing PDFs on every request
    private final ConcurrentHashMap<String, String> knowledgeCache = new ConcurrentHashMap<>();
    private long lastCacheUpdate = 0;
    private static final long CACHE_TTL = 300000; // 5 minutes

    /**
     * Get all text content from PDF files in the knowledge directory
     */
    public String getKnowledgeBaseContent() {
        // Refresh cache if needed
        if (System.currentTimeMillis() - lastCacheUpdate > CACHE_TTL) {
            refreshCache();
        }

        if (knowledgeCache.isEmpty()) {
            return "";
        }

        StringBuilder sb = new StringBuilder();
        sb.append("=== KNOWLEDGE BASE (USER PROVIDED DOCUMENTS) ===\n");

        knowledgeCache.forEach((filename, content) -> {
            sb.append("\n📄 DOCUMENT: ").append(filename).append("\n");
            sb.append("----------------------------------------\n");
            sb.append(content).append("\n");
            sb.append("----------------------------------------\n");
        });

        sb.append("=== END KNOWLEDGE BASE ===\n\n");
        return sb.toString();
    }

    private void refreshCache() {
        File folder = new File(KNOWLEDGE_DIR);
        if (!folder.exists() || !folder.isDirectory()) {
            logger.warn("⚠️ Knowledge directory not found at: {}. Trying /app/knowledge...", folder.getAbsolutePath());
            // Try container path
            folder = new File("/app/knowledge");
            if (!folder.exists()) {
                logger.warn("⚠️ Knowledge directory also not found at /app/knowledge. Knowledge base disabled.");
                return;
            }
        }

        File[] files = folder.listFiles((dir, name) -> name.toLowerCase().endsWith(".pdf"));
        if (files == null)
            return;

        logger.info("📚 Scanning knowledge base: {} files found", files.length);

        for (File file : files) {
            String filename = file.getName();
            // Simple check if file modified since last read could be added,
            // but for now we re-read every TTL to be safe.

            try {
                String text = extractTextFromPdf(file);
                // Truncate if too huge to prevent token explosion
                if (text.length() > 10000) {
                    text = text.substring(0, 10000) + "... [truncated]";
                }
                knowledgeCache.put(filename, text);
            } catch (Exception e) {
                logger.error("❌ Error reading PDF {}: {}", filename, e.getMessage());
            }
        }

        lastCacheUpdate = System.currentTimeMillis();
    }

    private String extractTextFromPdf(File file) throws IOException {
        try (PDDocument document = PDDocument.load(file)) {
            PDFTextStripper stripper = new PDFTextStripper();
            stripper.setSortByPosition(true);
            return stripper.getText(document).trim();
        }
    }
}
