package com.uit.cinema.chatbot.service;

import com.uit.cinema.chatbot.ai.EmbeddingDimensions;
import com.uit.cinema.chatbot.ai.EmbeddingPort;
import com.uit.cinema.chatbot.ai.LanguageModelPort;
import com.uit.cinema.chatbot.api.MessageResponse;
import com.uit.cinema.chatbot.config.ChatbotProperties;
import com.uit.cinema.chatbot.persistence.ChatMessage;
import com.uit.cinema.chatbot.persistence.ChatMessageRepository;
import com.uit.cinema.chatbot.persistence.Conversation;
import com.uit.cinema.chatbot.persistence.ConversationRepository;
import com.uit.cinema.chatbot.persistence.KnowledgeSource;
import com.uit.cinema.chatbot.persistence.KnowledgeSourceRepository;
import com.uit.cinema.chatbot.persistence.Sender;
import com.uit.cinema.chatbot.persistence.SourceStatus;
import com.uit.cinema.chatbot.security.ActorResolver;
import com.uit.cinema.core.exception.CustomException;
import com.uit.cinema.core.exception.ErrorCode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.function.Consumer;

@Slf4j
@Service
public class ReplyOrchestrator {

    private final ConversationService conversations;
    private final ConversationRepository conversationRepository;
    private final ChatMessageRepository messages;
    private final KnowledgeSourceRepository sources;
    private final JavaCosineRetrieval retrieval;
    private final LiveContext liveContext;
    private final EmbeddingPort embedding;
    private final LanguageModelPort model;
    private final ActorResolver actors;
    private final ChatbotProperties properties;
    private final MessageMapper mapper;
    private final TransactionTemplate transactions;

    public ReplyOrchestrator(
        ConversationService conversations,
        ConversationRepository conversationRepository,
        ChatMessageRepository messages,
        KnowledgeSourceRepository sources,
        JavaCosineRetrieval retrieval,
        LiveContext liveContext,
        EmbeddingPort embedding,
        LanguageModelPort model,
        ActorResolver actors,
        ChatbotProperties properties,
        MessageMapper mapper,
        PlatformTransactionManager transactionManager
    ) {
        this.conversations = conversations;
        this.conversationRepository = conversationRepository;
        this.messages = messages;
        this.sources = sources;
        this.retrieval = retrieval;
        this.liveContext = liveContext;
        this.embedding = embedding;
        this.model = model;
        this.actors = actors;
        this.properties = properties;
        this.mapper = mapper;
        this.transactions = new TransactionTemplate(transactionManager);
    }

    public MessageResponse replySync(UUID conversationId, long actorId, String message) {
        return reply(conversationId, actorId, message, false, event -> {
        });
    }

    public MessageResponse replyStream(UUID conversationId, long actorId, String message, Consumer<ChatStreamEvent> events) {
        return reply(conversationId, actorId, message, true, events);
    }

    private MessageResponse reply(
        UUID conversationId,
        long actorId,
        String message,
        boolean stream,
        Consumer<ChatStreamEvent> events
    ) {
        String question = requireQuestion(message);
        Conversation conversation = conversations.require(conversationId, actorId);
        transactions.executeWithoutResult(status -> append(conversation, Sender.USER, question, null));
        long started = System.nanoTime();
        try {
            if (!AnswerGuard.hasLetterOrDigit(question)) {
                return finish(conversation, properties.getRefusal(), List.of(), events);
            }
            if (!model.available() || !embedding.available()) {
                return finish(conversation, properties.getDisabledReply(), List.of(), events);
            }
            float[] query = embedding.embed(question);
            EmbeddingDimensions.check(query);
            List<PassageHit> hits = retrieval.search(
                properties.getTenantId(),
                query,
                properties.getTopK(),
                properties.getMaxDistance(),
                properties.getRelativeMargin()
            );
            List<String> facts = liveContext.collect(question, hits, actors.bookingLookupAllowed(), actorId);
            if (hits.isEmpty() && facts.isEmpty()) {
                return finish(conversation, properties.getRefusal(), List.of(), events);
            }
            List<ChatMessage> history = previousMessages(conversation.getId());
            String userPrompt = PromptBuilder.userPrompt(history, hits, facts, question, properties.getHistoryChars());
            String answer = AnswerGuard.stripEmoji(generate(PromptBuilder.systemPrompt(), userPrompt, stream));
            if (answer.isBlank() || mentionsForeignTitle(answer, question, history, hits, facts)) {
                log.info("chat reply replaced with refusal conversation={}", conversation.getId());
                return finish(conversation, properties.getRefusal(), List.of(), events);
            }
            List<Citation> citations = hits.stream()
                .map(hit -> new Citation(
                    hit.passageId(),
                    hit.sourceId(),
                    hit.title(),
                    hit.locator(),
                    AnswerGuard.clipCitation(hit.text(), properties.getCitationMaxChars())
                ))
                .toList();
            log.info(
                "chat reply conversation={} hits={} minDistance={} modelMs={}",
                conversation.getId(),
                hits.size(),
                hits.stream().mapToDouble(PassageHit::distance).min().orElse(-1),
                (System.nanoTime() - started) / 1_000_000
            );
            return finish(conversation, answer, citations, events);
        } catch (RuntimeException ex) {
            log.warn("chat reply failed: {}", ex.getClass().getSimpleName());
            events.accept(ChatStreamEvent.error("Lỗi kết nối AI"));
            throw new CustomException(ErrorCode.AI_UNAVAILABLE);
        }
    }

    private String generate(String systemPrompt, String userPrompt, boolean stream) {
        if (!stream) {
            return model.complete(systemPrompt, userPrompt);
        }
        StringBuilder answer = new StringBuilder();
        model.stream(systemPrompt, userPrompt, answer::append);
        return answer.toString();
    }

    private boolean mentionsForeignTitle(
        String answer,
        String question,
        List<ChatMessage> history,
        List<PassageHit> hits,
        List<String> facts
    ) {
        StringBuilder allowed = new StringBuilder(question);
        for (ChatMessage message : history) {
            allowed.append('\n').append(message.getContent());
        }
        for (PassageHit hit : hits) {
            allowed.append('\n').append(hit.title()).append('\n').append(hit.text());
        }
        for (String fact : facts) {
            allowed.append('\n').append(fact);
        }
        List<String> titles = sources.findByTenantIdAndStatus(properties.getTenantId(), SourceStatus.SUCCESS)
            .stream()
            .map(KnowledgeSource::getTitle)
            .toList();
        return AnswerGuard.mentionsForeignTitle(answer, allowed.toString(), titles);
    }

    private MessageResponse finish(Conversation conversation, String content, List<Citation> citations, Consumer<ChatStreamEvent> events) {
        events.accept(ChatStreamEvent.token(content));
        events.accept(ChatStreamEvent.citations(citations));
        MessageResponse saved = transactions.execute(status -> {
            ChatMessage message = append(conversation, Sender.ASSISTANT, content, citations);
            return mapper.message(message);
        });
        events.accept(ChatStreamEvent.done());
        return saved;
    }

    private ChatMessage append(Conversation conversation, Sender sender, String content, List<Citation> citations) {
        ChatMessage message = new ChatMessage();
        message.setConversationId(conversation.getId());
        message.setSender(sender);
        message.setContent(content);
        message.setCitations(citations == null ? null : mapper.writeCitations(citations));
        ChatMessage saved = messages.save(message);
        conversation.setLastMessageAt(Instant.now());
        conversationRepository.save(conversation);
        return saved;
    }

    private List<ChatMessage> previousMessages(UUID conversationId) {
        List<ChatMessage> all = messages.findByConversationIdOrderByCreatedAtAsc(conversationId);
        if (all.isEmpty()) {
            return List.of();
        }
        return new ArrayList<>(all.subList(0, all.size() - 1));
    }

    private String requireQuestion(String message) {
        if (message == null || message.isBlank()) {
            throw new CustomException(ErrorCode.INVALID_INPUT);
        }
        String trimmed = message.trim().replaceAll("\\s+", " ");
        if (trimmed.length() > 1000) {
            throw new CustomException(ErrorCode.INVALID_INPUT);
        }
        return trimmed;
    }
}
