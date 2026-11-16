package com.uit.cinema.chatbot.service;

import com.uit.cinema.chatbot.ai.EmbeddingDimensions;
import com.uit.cinema.chatbot.ai.EmbeddingPort;
import com.uit.cinema.chatbot.config.ChatbotProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class ChatbotStartup implements ApplicationRunner {

    private final EmbeddingPort embedding;
    private final KnowledgeIndexer indexer;
    private final ChatbotProperties properties;

    public ChatbotStartup(EmbeddingPort embedding, KnowledgeIndexer indexer, ChatbotProperties properties) {
        this.embedding = embedding;
        this.indexer = indexer;
        this.properties = properties;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (!embedding.available()) {
            log.info("Cinema chatbot AI is off");
            return;
        }
        EmbeddingDimensions.check(embedding.embed("ping"));
        if (!properties.isReindexOnStartup()) {
            return;
        }
        indexer.reindex();
    }
}
