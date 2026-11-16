package com.uit.cinema.chatbot.service;

import com.uit.cinema.chatbot.api.ConversationResponse;
import com.uit.cinema.chatbot.api.MessageResponse;
import com.uit.cinema.chatbot.config.ChatbotProperties;
import com.uit.cinema.chatbot.persistence.ChatMessageRepository;
import com.uit.cinema.chatbot.persistence.Conversation;
import com.uit.cinema.chatbot.persistence.ConversationRepository;
import com.uit.cinema.core.exception.CustomException;
import com.uit.cinema.core.exception.ErrorCode;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class ConversationService {

    private final ConversationRepository conversations;
    private final ChatMessageRepository messages;
    private final ChatbotProperties properties;
    private final MessageMapper mapper;

    public ConversationService(
        ConversationRepository conversations,
        ChatMessageRepository messages,
        ChatbotProperties properties,
        MessageMapper mapper
    ) {
        this.conversations = conversations;
        this.messages = messages;
        this.properties = properties;
        this.mapper = mapper;
    }

    @Transactional
    public ConversationResponse create(long actorId, String title) {
        Conversation conversation = new Conversation();
        conversation.setTenantId(properties.getTenantId());
        conversation.setActorId(actorId);
        conversation.setTitle(normalizeTitle(title, true));
        return mapper.conversation(conversations.save(conversation));
    }

    @Transactional(readOnly = true)
    public List<ConversationResponse> list(long actorId) {
        return conversations.findByTenantIdAndActorIdOrderByLastMessageAtDesc(properties.getTenantId(), actorId)
            .stream()
            .map(mapper::conversation)
            .toList();
    }

    @Transactional
    public ConversationResponse rename(UUID id, long actorId, String title) {
        Conversation conversation = require(id, actorId);
        conversation.setTitle(normalizeTitle(title, false));
        return mapper.conversation(conversation);
    }

    @Transactional
    public void delete(UUID id, long actorId) {
        Conversation conversation = require(id, actorId);
        messages.deleteByConversationId(conversation.getId());
        conversations.delete(conversation);
    }

    @Transactional(readOnly = true)
    public List<MessageResponse> messages(UUID id, long actorId) {
        Conversation conversation = require(id, actorId);
        return messages.findByConversationIdOrderByCreatedAtAsc(conversation.getId()).stream()
            .map(mapper::message)
            .toList();
    }

    public Conversation require(UUID id, long actorId) {
        return conversations.findByIdAndTenantIdAndActorId(id, properties.getTenantId(), actorId)
            .orElseThrow(() -> new CustomException(
                "Không tìm thấy cuộc trò chuyện",
                HttpStatus.NOT_FOUND,
                "CONVERSATION_NOT_FOUND"
            ));
    }

    private String normalizeTitle(String title, boolean allowBlank) {
        if (title == null || title.isBlank()) {
            if (allowBlank) {
                return "Trò chuyện mới";
            }
            throw new CustomException(ErrorCode.INVALID_INPUT);
        }
        String trimmed = title.trim();
        if (trimmed.length() > 255) {
            throw new CustomException(ErrorCode.INVALID_INPUT);
        }
        return trimmed;
    }
}
