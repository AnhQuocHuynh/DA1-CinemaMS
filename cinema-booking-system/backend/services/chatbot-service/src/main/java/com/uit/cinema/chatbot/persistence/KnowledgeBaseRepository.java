package com.uit.cinema.chatbot.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface KnowledgeBaseRepository extends JpaRepository<KnowledgeBase, UUID> {

    Optional<KnowledgeBase> findByTenantIdAndName(UUID tenantId, String name);
}
