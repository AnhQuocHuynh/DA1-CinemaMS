package com.uit.cinema.chatbot;

import com.uit.cinema.chatbot.ai.EmbeddingPort;
import com.uit.cinema.chatbot.ai.LanguageModelPort;
import com.uit.cinema.chatbot.ai.TestVectors;
import com.uit.cinema.chatbot.api.MessageResponse;
import com.uit.cinema.chatbot.config.ChatbotProperties;
import com.uit.cinema.chatbot.persistence.ChatMessage;
import com.uit.cinema.chatbot.persistence.ChatMessageRepository;
import com.uit.cinema.chatbot.persistence.ConversationRepository;
import com.uit.cinema.chatbot.persistence.KnowledgeBase;
import com.uit.cinema.chatbot.persistence.KnowledgeBaseRepository;
import com.uit.cinema.chatbot.persistence.KnowledgeSource;
import com.uit.cinema.chatbot.persistence.KnowledgeSourceRepository;
import com.uit.cinema.chatbot.persistence.Passage;
import com.uit.cinema.chatbot.persistence.PassageRepository;
import com.uit.cinema.chatbot.persistence.Sender;
import com.uit.cinema.chatbot.persistence.SourceStatus;
import com.uit.cinema.chatbot.service.BookingKnowledgeClient;
import com.uit.cinema.chatbot.service.CatalogDocument;
import com.uit.cinema.chatbot.service.CatalogKnowledgeClient;
import com.uit.cinema.chatbot.service.ChatStreamEvent;
import com.uit.cinema.chatbot.service.ConversationService;
import com.uit.cinema.chatbot.service.JavaCosineRetrieval;
import com.uit.cinema.chatbot.service.KnowledgeIndexer;
import com.uit.cinema.chatbot.service.LiveContext;
import com.uit.cinema.chatbot.service.MessageMapper;
import com.uit.cinema.chatbot.service.RecommendationKnowledgeClient;
import com.uit.cinema.chatbot.service.ReplyOrchestrator;
import com.uit.cinema.chatbot.service.ShowtimeKnowledgeClient;
import com.uit.cinema.chatbot.security.ActorResolver;
import com.uit.cinema.core.exception.CustomException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class ChatbotFlowTest {

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private ConversationService conversations;
    @Autowired
    private ReplyOrchestrator orchestrator;
    @Autowired
    private JavaCosineRetrieval retrieval;
    @Autowired
    private KnowledgeIndexer indexer;
    @Autowired
    private ChatbotProperties properties;
    @Autowired
    private KnowledgeBaseRepository knowledgeBases;
    @Autowired
    private KnowledgeSourceRepository sources;
    @Autowired
    private PassageRepository passages;
    @Autowired
    private ConversationRepository conversationRepository;
    @Autowired
    private ChatMessageRepository messages;
    @Autowired
    private LiveContext liveContext;
    @Autowired
    private ActorResolver actors;
    @Autowired
    private MessageMapper mapper;
    @Autowired
    private PlatformTransactionManager transactionManager;

    @MockBean
    private EmbeddingPort embedding;
    @MockBean
    private LanguageModelPort model;
    @MockBean
    private CatalogKnowledgeClient catalog;
    @MockBean
    private ShowtimeKnowledgeClient showtimes;
    @MockBean
    private BookingKnowledgeClient bookings;
    @MockBean
    private RecommendationKnowledgeClient recommendations;

    @BeforeEach
    void clean() {
        messages.deleteAll();
        conversationRepository.deleteAll();
        passages.deleteAll();
        sources.deleteAll();
        knowledgeBases.deleteAll();
    }

    @Test
    void twoTenantsDoNotSharePassages() {
        UUID otherTenant = UUID.fromString("22222222-2222-2222-2222-222222222222");
        savePassage(properties.getTenantId(), "Phim A", TestVectors.ones());
        savePassage(otherTenant, "Phim B", TestVectors.ones());

        var hits = retrieval.search(properties.getTenantId(), TestVectors.ones(), 5, 0.55, 0.08);

        assertEquals(1, hits.size());
        assertEquals("Phim A", hits.get(0).text());
    }

    @Test
    void distantPassagesAreDropped() {
        savePassage(properties.getTenantId(), "Xa", TestVectors.axis(0));
        var hits = retrieval.search(properties.getTenantId(), TestVectors.axis(1), 5, 0.55, 0.08);
        assertTrue(hits.isEmpty());
    }

    @Test
    void failedSourceIsNotRetrievedAndReindexDoesNotAccumulate() {
        when(embedding.available()).thenReturn(true);
        when(embedding.embedAll(any())).thenAnswer(invocation -> {
            List<String> texts = invocation.getArgument(0);
            return texts.stream().map(text -> TestVectors.ones()).toList();
        });
        when(catalog.listMovies()).thenReturn(List.of(movie("Nội dung Inception")));
        when(catalog.listEvents()).thenReturn(List.of());

        indexer.reindex();
        indexer.reindex();

        KnowledgeSource movie = sources.findByTenantIdAndKnowledgeBaseIdAndExternalKey(
            properties.getTenantId(),
            knowledgeBases.findByTenantIdAndName(properties.getTenantId(), "catalog").orElseThrow().getId(),
            "movie:7"
        ).orElseThrow();
        assertEquals(SourceStatus.SUCCESS, movie.getStatus());
        assertEquals(1, passages.countBySourceId(movie.getId()));
    }

    @Test
    void blankSourceIsFailedWithoutPassages() {
        when(embedding.available()).thenReturn(true);
        when(embedding.embedAll(any())).thenAnswer(invocation -> {
            List<String> texts = invocation.getArgument(0);
            return texts.stream().map(text -> TestVectors.ones()).toList();
        });
        when(catalog.listMovies()).thenReturn(List.of(new CatalogDocument("movie:8", "Rỗng", "  ", "{}")));
        when(catalog.listEvents()).thenReturn(List.of());

        indexer.reindex();

        KnowledgeSource movie = sources.findByTenantIdAndKnowledgeBaseIdAndExternalKey(
            properties.getTenantId(),
            knowledgeBases.findByTenantIdAndName(properties.getTenantId(), "catalog").orElseThrow().getId(),
            "movie:8"
        ).orElseThrow();
        assertEquals(SourceStatus.FAILED, movie.getStatus());
        assertEquals(0, passages.countBySourceId(movie.getId()));
    }

    @Test
    void anotherActorCannotReadRenameOrDelete() {
        var created = conversations.create(1L, "Của tôi");
        assertThrows(CustomException.class, () -> conversations.messages(created.id(), 2L));
        assertThrows(CustomException.class, () -> conversations.rename(created.id(), 2L, "Đổi"));
        assertThrows(CustomException.class, () -> conversations.delete(created.id(), 2L));
        assertEquals(1, conversations.list(1L).size());
        assertTrue(conversations.list(2L).isEmpty());
    }

    @Test
    void refusalDoesNotCallTheModelAndCitationUsesThePassageId() {
        when(model.available()).thenReturn(true);
        when(embedding.available()).thenReturn(true);
        when(embedding.embed(anyString())).thenReturn(TestVectors.ones());
        var created = conversations.create(0L, "Hỏi");

        orchestrator.replySync(created.id(), 0L, "thời tiết hôm nay");
        verify(model, never()).complete(any(), any());
        verify(bookings, never()).linesForUser(anyLong());

        var passage = savePassage(properties.getTenantId(), "Inception là phim về giấc mơ.", TestVectors.ones());
        AtomicReference<String> prompt = new AtomicReference<>();
        when(model.complete(any(), any())).thenAnswer(invocation -> {
            assertFalse(TransactionSynchronizationManager.isActualTransactionActive());
            prompt.set(invocation.getArgument(1));
            return "Inception kể về giấc mơ.";
        });

        MessageResponse answer = orchestrator.replySync(created.id(), 0L, "Inception nói về gì");
        assertEquals(passage.getId(), answer.citations().get(0).passageId());
        assertTrue(answer.citations().get(0).text().contains("giấc mơ"));
        assertTrue(prompt.get().contains("thời tiết"));
    }

    @Test
    void historyComesFromTheDatabaseForANewOrchestrator() {
        when(model.available()).thenReturn(true);
        when(embedding.available()).thenReturn(true);
        when(embedding.embed(anyString())).thenReturn(TestVectors.ones());
        savePassage(properties.getTenantId(), "Inception là phim về giấc mơ.", TestVectors.ones());
        var created = conversations.create(0L, "Hỏi");
        ChatMessage prior = new ChatMessage();
        prior.setConversationId(created.id());
        prior.setSender(Sender.USER);
        prior.setContent("da xem Inception");
        prior.setCreatedAt(Instant.parse("2020-01-01T00:00:00Z"));
        messages.save(prior);

        AtomicReference<String> firstPrompt = new AtomicReference<>();
        when(model.complete(any(), any())).thenAnswer(invocation -> {
            assertFalse(TransactionSynchronizationManager.isActualTransactionActive());
            firstPrompt.set(invocation.getArgument(1));
            return "Inception kể về giấc mơ.";
        });
        orchestrator.replySync(created.id(), 0L, "Noi dung phim?");
        assertTrue(firstPrompt.get().contains("da xem Inception"));

        ReplyOrchestrator second = new ReplyOrchestrator(
            conversations,
            conversationRepository,
            messages,
            sources,
            retrieval,
            liveContext,
            embedding,
            model,
            actors,
            properties,
            mapper,
            transactionManager
        );
        AtomicReference<String> secondPrompt = new AtomicReference<>();
        when(model.complete(any(), any())).thenAnswer(invocation -> {
            secondPrompt.set(invocation.getArgument(1));
            return "Van la giac mo.";
        });
        second.replySync(created.id(), 0L, "Nhac lai di");
        assertTrue(secondPrompt.get().contains("Inception kể về giấc mơ."));
    }

    @Test
    void disabledAssistantStoresAFixedReply() throws Exception {
        String body = mockMvc.perform(post("/api/chatbot/conversations").contentType(MediaType.APPLICATION_JSON).content("{}"))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();
        String id = body.replaceAll(".*\"id\":\"([^\"]+)\".*", "$1");
        mockMvc.perform(post("/api/chatbot/conversations/" + id + "/messages")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"message\":\"Inception\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.content").value("Trợ lý đang tắt."));
        mockMvc.perform(post("/api/chatbot/conversations/" + id + "/messages")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"message\":\"\"}"))
            .andExpect(status().isBadRequest());
        mockMvc.perform(post("/internal/chatbot/reindex"))
            .andExpect(status().isUnauthorized());
        mockMvc.perform(post("/internal/chatbot/reindex").header("X-Internal-Token", "test-token"))
            .andExpect(status().isBadGateway());
        mockMvc.perform(delete("/api/chatbot/conversations/" + id)).andExpect(status().isNoContent());
        mockMvc.perform(get("/api/chatbot/conversations/" + id + "/messages")).andExpect(status().isNotFound());
    }

    @Test
    void streamEmitsTokensThenCitations() {
        when(model.available()).thenReturn(true);
        when(embedding.available()).thenReturn(true);
        when(embedding.embed(anyString())).thenReturn(TestVectors.ones());
        var passage = savePassage(properties.getTenantId(), "Noi dung", TestVectors.ones());
        org.mockito.Mockito.doAnswer(invocation -> {
            java.util.function.Consumer<String> tokens = invocation.getArgument(2);
            tokens.accept("Xin ");
            tokens.accept("chào");
            return null;
        }).when(model).stream(any(), any(), any());
        var created = conversations.create(0L, "Stream");
        List<ChatStreamEvent> events = new ArrayList<>();
        MessageResponse saved = orchestrator.replyStream(created.id(), 0L, "hoi", events::add);
        assertEquals("Xin chào", saved.content());
        assertEquals("token", events.get(0).type());
        assertEquals("Xin chào", events.get(0).content());
        assertEquals("citations", events.get(1).type());
        assertEquals(passage.getId(), events.get(1).citations().get(0).passageId());
        assertEquals("done", events.get(2).type());
    }

    @Test
    void punctuationDoesNotCallTheEmbeddingModel() {
        when(model.available()).thenReturn(true);
        when(embedding.available()).thenReturn(true);
        var created = conversations.create(0L, "Rỗng");
        MessageResponse answer = orchestrator.replySync(created.id(), 0L, "???");
        assertEquals(properties.getRefusal(), answer.content());
        assertTrue(answer.citations().isEmpty());
        verify(embedding, never()).embed(anyString());
        verify(model, never()).complete(any(), any());
    }

    @Test
    void foreignCatalogTitleIsReplacedWithRefusal() {
        when(model.available()).thenReturn(true);
        when(embedding.available()).thenReturn(true);
        when(embedding.embed(anyString())).thenReturn(TestVectors.ones());
        savePassage(properties.getTenantId(), "Inception là phim về giấc mơ.", TestVectors.ones());
        KnowledgeBase base = knowledgeBases.findByTenantIdAndName(properties.getTenantId(), "catalog").orElseThrow();
        KnowledgeSource dune = new KnowledgeSource();
        dune.setTenantId(properties.getTenantId());
        dune.setKnowledgeBaseId(base.getId());
        dune.setExternalKey("movie:dune");
        dune.setTitle("Dune: Part Two");
        dune.setStatus(SourceStatus.SUCCESS);
        sources.save(dune);
        when(model.complete(any(), any())).thenReturn("Dune: Part Two cũng đáng xem.");
        var created = conversations.create(0L, "Hỏi");
        MessageResponse answer = orchestrator.replySync(created.id(), 0L, "Inception nói về gì");
        assertEquals(properties.getRefusal(), answer.content());
        assertTrue(answer.citations().isEmpty());
    }

    @Test
    void nearerNeighborsOutsideTheMarginAreDropped() {
        savePassage(properties.getTenantId(), "gan", angled(0.90), "Gan");
        savePassage(properties.getTenantId(), "vua", angled(0.84), "Vua");
        savePassage(properties.getTenantId(), "xa", angled(0.70), "Xa");
        var hits = retrieval.search(properties.getTenantId(), TestVectors.axis(0), 5, 0.40, 0.08);
        assertEquals(2, hits.size());
        assertTrue(hits.stream().noneMatch(hit -> "Xa".equals(hit.text())));
    }

    @Test
    void missingMovieIsRemovedOnlyAfterASuccessfulCatalogRead() {
        when(embedding.available()).thenReturn(true);
        when(embedding.embedAll(any())).thenAnswer(invocation -> {
            List<String> texts = invocation.getArgument(0);
            return texts.stream().map(text -> TestVectors.ones()).toList();
        });
        when(catalog.listEvents()).thenReturn(List.of());
        when(catalog.listMovies()).thenReturn(List.of(movie("Mot"), movie(9, "Hai")));
        indexer.reindex();
        when(catalog.listMovies()).thenReturn(List.of(movie("Mot")));
        indexer.reindex();
        UUID catalogId = knowledgeBases.findByTenantIdAndName(properties.getTenantId(), "catalog").orElseThrow().getId();
        assertTrue(sources.findByTenantIdAndKnowledgeBaseIdAndExternalKey(properties.getTenantId(), catalogId, "movie:7").isPresent());
        assertTrue(sources.findByTenantIdAndKnowledgeBaseIdAndExternalKey(properties.getTenantId(), catalogId, "movie:9").isEmpty());

        when(catalog.listMovies()).thenThrow(new org.springframework.web.client.RestClientException("down"));
        indexer.reindex();
        assertTrue(sources.findByTenantIdAndKnowledgeBaseIdAndExternalKey(properties.getTenantId(), catalogId, "movie:7").isPresent());
    }

    private Passage savePassage(UUID tenantId, String text, float[] vector) {
        KnowledgeBase base = knowledgeBases.findByTenantIdAndName(tenantId, "catalog").orElseGet(() -> {
            KnowledgeBase created = new KnowledgeBase();
            created.setTenantId(tenantId);
            created.setName("catalog");
            return knowledgeBases.save(created);
        });
        KnowledgeSource source = new KnowledgeSource();
        source.setTenantId(tenantId);
        source.setKnowledgeBaseId(base.getId());
        source.setExternalKey("movie:" + UUID.randomUUID());
        source.setTitle("Inception");
        source.setStatus(SourceStatus.SUCCESS);
        source = sources.save(source);
        Passage passage = new Passage();
        passage.setTenantId(tenantId);
        passage.setSourceId(source.getId());
        passage.setOrdinal(0);
        passage.setContent(text);
        passage.setEmbedding(vector);
        passage.setMetadata("{\"title\":\"Inception\",\"locator\":\"movie/7\",\"movieId\":7}");
        return passages.save(passage);
    }

    private CatalogDocument movie(String body) {
        return movie(7, body);
    }

    private CatalogDocument movie(long id, String body) {
        return new CatalogDocument(
            "movie:" + id,
            "Inception",
            body,
            "{\"kind\":\"movie\",\"movieId\":" + id + ",\"title\":\"Inception\",\"locator\":\"movie/" + id + "\"}"
        );
    }

    private Passage savePassage(UUID tenantId, String text, float[] vector, String title) {
        Passage passage = savePassage(tenantId, text, vector);
        passage.setContent(text);
        passage.setMetadata("{\"title\":\"" + title + "\",\"locator\":\"movie/1\"}");
        return passages.save(passage);
    }

    private static float[] angled(double similarity) {
        float[] values = new float[com.uit.cinema.chatbot.ai.EmbeddingDimensions.LENGTH];
        values[0] = (float) similarity;
        values[1] = (float) Math.sqrt(Math.max(0d, 1d - similarity * similarity));
        return values;
    }

}
