package com.uit.cinema.chatbot.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.uit.cinema.chatbot.api.ConversationResponse;
import com.uit.cinema.chatbot.api.MessageResponse;
import com.uit.cinema.chatbot.persistence.ChatMessage;
import com.uit.cinema.chatbot.persistence.Conversation;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class MessageMapper {

    private final ObjectMapper objectMapper;

    public MessageMapper(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public ConversationResponse conversation(Conversation conversation) {
        return new ConversationResponse(
            conversation.getId(),
            conversation.getTitle(),
            conversation.getCreatedAt(),
            conversation.getLastMessageAt()
        );
    }

    public MessageResponse message(ChatMessage message) {
        return new MessageResponse(
            message.getId(),
            message.getSender().name(),
            message.getContent(),
            readCitations(message.getCitations()),
            message.getCreatedAt()
        );
    }

    public String writeCitations(List<Citation> citations) {
        try {
            return objectMapper.writeValueAsString(citations == null ? List.of() : citations);
        } catch (Exception ex) {
            return "[]";
        }
    }

    private List<Citation> readCitations(String json) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<List<Citation>>() {
            });
        } catch (Exception ex) {
            return List.of();
        }
    }
}
