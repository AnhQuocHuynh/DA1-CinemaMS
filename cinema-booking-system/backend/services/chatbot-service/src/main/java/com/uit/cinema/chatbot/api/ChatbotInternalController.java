package com.uit.cinema.chatbot.api;

import com.uit.cinema.chatbot.service.KnowledgeIndexer;
import com.uit.cinema.core.dto.response.ApiResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/internal/chatbot")
public class ChatbotInternalController {

    private final KnowledgeIndexer indexer;

    public ChatbotInternalController(KnowledgeIndexer indexer) {
        this.indexer = indexer;
    }

    @PostMapping("/reindex")
    public ResponseEntity<ApiResponse<ReindexResponse>> reindex() {
        return ResponseEntity.ok(ApiResponse.success(indexer.reindex()));
    }
}
