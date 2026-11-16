package com.uit.cinema.chatbot.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface KnowledgeSourceRepository extends JpaRepository<KnowledgeSource, UUID> {

    Optional<KnowledgeSource> findByTenantIdAndKnowledgeBaseIdAndExternalKey(
        UUID tenantId,
        UUID knowledgeBaseId,
        String externalKey
    );

    List<KnowledgeSource> findByTenantIdAndKnowledgeBaseId(UUID tenantId, UUID knowledgeBaseId);

    List<KnowledgeSource> findByTenantIdAndStatus(UUID tenantId, SourceStatus status);
}
