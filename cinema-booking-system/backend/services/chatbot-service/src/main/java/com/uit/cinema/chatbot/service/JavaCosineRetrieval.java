package com.uit.cinema.chatbot.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.uit.cinema.chatbot.ai.Cosine;
import com.uit.cinema.chatbot.persistence.Passage;
import com.uit.cinema.chatbot.persistence.PassageRepository;
import com.uit.cinema.chatbot.persistence.SourceStatus;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

@Service
public class JavaCosineRetrieval {

    private final PassageRepository passageRepository;
    private final ObjectMapper objectMapper;

    public JavaCosineRetrieval(PassageRepository passageRepository, ObjectMapper objectMapper) {
        this.passageRepository = passageRepository;
        this.objectMapper = objectMapper;
    }

    public List<PassageHit> search(UUID tenantId, float[] query, int limit, double maxDistance, double relativeMargin) {
        List<PassageHit> hits = new ArrayList<>();
        for (Passage passage : passageRepository.findByTenantAndSourceStatus(tenantId, SourceStatus.SUCCESS)) {
            double distance = Cosine.distance(query, passage.getEmbedding());
            if (distance > maxDistance) {
                continue;
            }
            JsonNode metadata = read(passage.getMetadata());
            hits.add(new PassageHit(
                passage.getId(),
                passage.getSourceId(),
                metadata.path("title").asText(""),
                metadata.path("locator").asText(""),
                passage.getContent(),
                passage.getMetadata(),
                distance
            ));
        }
        hits.sort(Comparator.comparingDouble(PassageHit::distance));
        return withinMargin(hits, relativeMargin, limit);
    }

    static List<PassageHit> withinMargin(List<PassageHit> sortedByDistance, double relativeMargin, int limit) {
        if (sortedByDistance.isEmpty() || limit <= 0) {
            return List.of();
        }
        double ceiling = sortedByDistance.get(0).distance() + Math.max(0d, relativeMargin);
        List<PassageHit> kept = new ArrayList<>();
        for (PassageHit hit : sortedByDistance) {
            if (hit.distance() > ceiling) {
                break;
            }
            kept.add(hit);
            if (kept.size() == limit) {
                break;
            }
        }
        return List.copyOf(kept);
    }

    private JsonNode read(String metadata) {
        try {
            return objectMapper.readTree(metadata == null ? "{}" : metadata);
        } catch (Exception ex) {
            return objectMapper.createObjectNode();
        }
    }
}
