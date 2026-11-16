package com.uit.cinema.chatbot.service;

import com.uit.cinema.chatbot.ai.EmbeddingDimensions;
import com.uit.cinema.chatbot.ai.EmbeddingPort;
import com.uit.cinema.chatbot.ai.TextSplitter;
import com.uit.cinema.chatbot.api.ReindexResponse;
import com.uit.cinema.chatbot.config.ChatbotProperties;
import com.uit.cinema.chatbot.persistence.KnowledgeBase;
import com.uit.cinema.chatbot.persistence.KnowledgeBaseRepository;
import com.uit.cinema.chatbot.persistence.KnowledgeSource;
import com.uit.cinema.chatbot.persistence.KnowledgeSourceRepository;
import com.uit.cinema.chatbot.persistence.Passage;
import com.uit.cinema.chatbot.persistence.PassageRepository;
import com.uit.cinema.chatbot.persistence.SourceStatus;
import com.uit.cinema.core.exception.CustomException;
import com.uit.cinema.core.exception.ErrorCode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.client.RestClientException;

import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Slf4j
@Service
public class KnowledgeIndexer {

    private final KnowledgeBaseRepository knowledgeBases;
    private final KnowledgeSourceRepository sources;
    private final PassageRepository passages;
    private final CatalogKnowledgeClient catalog;
    private final EmbeddingPort embedding;
    private final TextSplitter splitter;
    private final ChatbotProperties properties;
    private final TransactionTemplate transactions;

    public KnowledgeIndexer(
        KnowledgeBaseRepository knowledgeBases,
        KnowledgeSourceRepository sources,
        PassageRepository passages,
        CatalogKnowledgeClient catalog,
        EmbeddingPort embedding,
        TextSplitter splitter,
        ChatbotProperties properties,
        PlatformTransactionManager transactionManager
    ) {
        this.knowledgeBases = knowledgeBases;
        this.sources = sources;
        this.passages = passages;
        this.catalog = catalog;
        this.embedding = embedding;
        this.splitter = splitter;
        this.properties = properties;
        this.transactions = new TransactionTemplate(transactionManager);
    }

    public ReindexResponse reindex() {
        if (!embedding.available()) {
            throw new CustomException(ErrorCode.AI_UNAVAILABLE);
        }
        UUID tenantId = properties.getTenantId();
        UUID catalogBase = ensureBase(tenantId, "catalog");
        UUID guideBase = ensureBase(tenantId, "guide");
        int writtenSources = 0;
        int writtenPassages = 0;
        try {
            List<CatalogDocument> movies = catalog.listMovies();
            for (CatalogDocument movie : movies) {
                writtenPassages += indexDocument(tenantId, catalogBase, movie);
                writtenSources++;
            }
            removeMissing(tenantId, catalogBase, "movie:", movies);
        } catch (RestClientException ex) {
            log.warn("Catalog movie reindex skipped: {}", ex.getClass().getSimpleName());
        }
        try {
            List<CatalogDocument> events = catalog.listEvents();
            for (CatalogDocument event : events) {
                writtenPassages += indexDocument(tenantId, catalogBase, event);
                writtenSources++;
            }
            removeMissing(tenantId, catalogBase, "event:", events);
        } catch (RestClientException ex) {
            log.warn("Catalog event reindex skipped: {}", ex.getClass().getSimpleName());
        }
        writtenPassages += indexDocument(tenantId, guideBase, guideDocument());
        writtenSources++;
        return new ReindexResponse(writtenSources, writtenPassages);
    }

    private int indexDocument(UUID tenantId, UUID knowledgeBaseId, CatalogDocument document) {
        UUID sourceId = transactions.execute(status -> upsertSource(tenantId, knowledgeBaseId, document, SourceStatus.PROCESSING, null));
        try {
            List<String> chunks = splitter.splitWithHeading(document.body(), heading(document));
            if (chunks.isEmpty()) {
                mark(sourceId, SourceStatus.FAILED, "empty");
                return 0;
            }
            List<float[]> vectors = embedding.embedAll(chunks);
            if (vectors.size() != chunks.size()) {
                mark(sourceId, SourceStatus.FAILED, "embedding-count");
                return 0;
            }
            for (float[] vector : vectors) {
                EmbeddingDimensions.check(vector);
            }
            transactions.executeWithoutResult(status -> replacePassages(tenantId, sourceId, document, chunks, vectors));
            return chunks.size();
        } catch (RuntimeException ex) {
            log.warn("Source index failed for {}: {}", document.externalKey(), ex.getClass().getSimpleName());
            mark(sourceId, SourceStatus.FAILED, ex.getClass().getSimpleName());
            return 0;
        }
    }

    private void mark(UUID sourceId, SourceStatus status, String error) {
        transactions.executeWithoutResult(tx -> {
            passages.deleteBySourceId(sourceId);
            KnowledgeSource source = sources.findById(sourceId).orElseThrow();
            source.setStatus(status);
            source.setErrorMessage(error);
        });
    }

    private void replacePassages(UUID tenantId, UUID sourceId, CatalogDocument document, List<String> chunks, List<float[]> vectors) {
        passages.deleteBySourceId(sourceId);
        for (int i = 0; i < chunks.size(); i++) {
            Passage passage = new Passage();
            passage.setTenantId(tenantId);
            passage.setSourceId(sourceId);
            passage.setOrdinal(i);
            passage.setContent(chunks.get(i));
            passage.setEmbedding(vectors.get(i));
            passage.setMetadata(document.metadataJson());
            passages.save(passage);
        }
        KnowledgeSource source = sources.findById(sourceId).orElseThrow();
        source.setStatus(SourceStatus.SUCCESS);
        source.setErrorMessage(null);
        source.setTitle(document.title());
    }

    private UUID upsertSource(UUID tenantId, UUID knowledgeBaseId, CatalogDocument document, SourceStatus status, String error) {
        KnowledgeSource source = sources.findByTenantIdAndKnowledgeBaseIdAndExternalKey(tenantId, knowledgeBaseId, document.externalKey())
            .orElseGet(KnowledgeSource::new);
        source.setTenantId(tenantId);
        source.setKnowledgeBaseId(knowledgeBaseId);
        source.setExternalKey(document.externalKey());
        source.setTitle(document.title() == null || document.title().isBlank() ? document.externalKey() : document.title());
        source.setStatus(status);
        source.setErrorMessage(error);
        return sources.save(source).getId();
    }

    private void removeMissing(UUID tenantId, UUID knowledgeBaseId, String keyPrefix, List<CatalogDocument> documents) {
        Set<String> keys = new HashSet<>();
        for (CatalogDocument document : documents) {
            keys.add(document.externalKey());
        }
        for (KnowledgeSource source : sources.findByTenantIdAndKnowledgeBaseId(tenantId, knowledgeBaseId)) {
            String key = source.getExternalKey();
            if (key == null || !key.startsWith(keyPrefix) || keys.contains(key)) {
                continue;
            }
            UUID sourceId = source.getId();
            transactions.executeWithoutResult(status -> {
                passages.deleteBySourceId(sourceId);
                sources.deleteById(sourceId);
            });
        }
    }

    private static String heading(CatalogDocument document) {
        if (document.title() == null || document.title().isBlank()) {
            return "";
        }
        String label = document.externalKey() != null && document.externalKey().startsWith("event:") ? "Sự kiện: " : "Tiêu đề: ";
        return label + document.title().trim();
    }

    private UUID ensureBase(UUID tenantId, String name) {
        return transactions.execute(status -> {
            KnowledgeBase existing = knowledgeBases.findByTenantIdAndName(tenantId, name).orElse(null);
            if (existing != null) {
                return existing.getId();
            }
            KnowledgeBase created = new KnowledgeBase();
            created.setTenantId(tenantId);
            created.setName(name);
            return knowledgeBases.save(created).getId();
        });
    }

    private CatalogDocument guideDocument() {
        try {
            ClassPathResource resource = new ClassPathResource("guide/booking-guide.md");
            String body = new String(resource.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
            return new CatalogDocument(
                "guide:booking",
                "Hướng dẫn đặt vé",
                body,
                "{\"kind\":\"guide\",\"title\":\"Hướng dẫn đặt vé\",\"locator\":\"guide/booking\"}"
            );
        } catch (Exception ex) {
            return new CatalogDocument("guide:booking", "Hướng dẫn đặt vé", "", "{\"kind\":\"guide\"}");
        }
    }
}
