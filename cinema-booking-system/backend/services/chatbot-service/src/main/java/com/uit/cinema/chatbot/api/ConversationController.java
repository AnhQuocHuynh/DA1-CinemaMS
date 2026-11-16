package com.uit.cinema.chatbot.api;

import com.uit.cinema.chatbot.security.ActorResolver;
import com.uit.cinema.chatbot.service.ChatStreamEvent;
import com.uit.cinema.chatbot.service.ConversationService;
import com.uit.cinema.chatbot.service.ReplyOrchestrator;
import com.uit.cinema.core.dto.response.ApiResponse;
import com.uit.cinema.core.exception.CustomException;
import com.uit.cinema.core.exception.ErrorCode;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Executor;
import java.util.concurrent.RejectedExecutionException;

@RestController
@RequestMapping("/api/chatbot/conversations")
public class ConversationController {

    private final ConversationService conversations;
    private final ReplyOrchestrator replies;
    private final ActorResolver actors;
    private final Executor chatbotReplyExecutor;

    public ConversationController(
        ConversationService conversations,
        ReplyOrchestrator replies,
        ActorResolver actors,
        @Qualifier("chatbotReplyExecutor") Executor chatbotReplyExecutor
    ) {
        this.conversations = conversations;
        this.replies = replies;
        this.actors = actors;
        this.chatbotReplyExecutor = chatbotReplyExecutor;
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<ConversationResponse>>> list() {
        return ResponseEntity.ok(ApiResponse.success(conversations.list(actors.currentActor())));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<ConversationResponse>> create(
        @RequestBody(required = false) @Valid CreateConversationRequest request
    ) {
        String title = request == null ? null : request.title();
        return ResponseEntity.ok(ApiResponse.success(conversations.create(actors.currentActor(), title)));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<ApiResponse<ConversationResponse>> rename(
        @PathVariable UUID id,
        @Valid @RequestBody RenameConversationRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(conversations.rename(id, actors.currentActor(), request.title())));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        conversations.delete(id, actors.currentActor());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/messages")
    public ResponseEntity<ApiResponse<List<MessageResponse>>> messages(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(conversations.messages(id, actors.currentActor())));
    }

    @PostMapping("/{id}/messages")
    public ResponseEntity<ApiResponse<MessageResponse>> post(
        @PathVariable UUID id,
        @Valid @RequestBody PostMessageRequest request
    ) {
        MessageResponse message = replies.replySync(id, actors.currentActor(), request.message());
        return ResponseEntity.ok(ApiResponse.success(message));
    }

    @PostMapping(value = "/{id}/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream(@PathVariable UUID id, @Valid @RequestBody PostMessageRequest request) {
        long actorId = actors.currentActor();
        conversations.require(id, actorId);
        SseEmitter emitter = new SseEmitter(120_000L);
        try {
            chatbotReplyExecutor.execute(() -> {
                try {
                    replies.replyStream(id, actorId, request.message(), event -> write(emitter, event));
                    emitter.complete();
                } catch (CustomException ex) {
                    emitter.complete();
                } catch (RuntimeException ex) {
                    write(emitter, ChatStreamEvent.error("Lỗi kết nối AI"));
                    emitter.complete();
                }
            });
        } catch (RejectedExecutionException ex) {
            throw new CustomException("Lỗi kết nối AI", HttpStatus.BAD_GATEWAY, ErrorCode.AI_UNAVAILABLE.getCode());
        }
        return emitter;
    }

    private void write(SseEmitter emitter, ChatStreamEvent event) {
        try {
            String name = switch (event.type()) {
                case "token" -> "message";
                case "citations" -> "citations";
                case "done" -> "done";
                default -> "error";
            };
            Object data = switch (event.type()) {
                case "token" -> event.content();
                case "citations" -> event.citations();
                case "done" -> "[DONE]";
                default -> event.message();
            };
            emitter.send(SseEmitter.event().name(name).data(data));
        } catch (IOException ex) {
            emitter.complete();
        }
    }
}
