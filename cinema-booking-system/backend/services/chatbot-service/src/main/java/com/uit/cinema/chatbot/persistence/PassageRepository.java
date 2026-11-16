package com.uit.cinema.chatbot.persistence;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface PassageRepository extends JpaRepository<Passage, UUID> {

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("delete from Passage p where p.sourceId = :sourceId")
    void deleteBySourceId(@Param("sourceId") UUID sourceId);

    long countBySourceId(UUID sourceId);

    @Query("""
        select p from Passage p
        where p.tenantId = :tenantId
          and p.sourceId in (
            select s.id from KnowledgeSource s
            where s.tenantId = :tenantId
              and s.status = :status
          )
        """)
    List<Passage> findByTenantAndSourceStatus(@Param("tenantId") UUID tenantId, @Param("status") SourceStatus status);
}
