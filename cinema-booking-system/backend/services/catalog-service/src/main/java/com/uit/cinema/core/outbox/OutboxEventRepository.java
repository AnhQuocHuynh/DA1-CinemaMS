package com.uit.cinema.core.outbox;

import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface OutboxEventRepository extends JpaRepository<OutboxEvent, UUID> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
        SELECT event FROM OutboxEvent event
        WHERE event.status = :status
          AND event.nextAttemptAt <= :now
        ORDER BY event.occurredAt ASC
        """)
    List<OutboxEvent> findPendingForDispatch(
        @Param("status") OutboxEvent.OutboxStatus status,
        @Param("now") Instant now,
        Pageable pageable
    );
}
