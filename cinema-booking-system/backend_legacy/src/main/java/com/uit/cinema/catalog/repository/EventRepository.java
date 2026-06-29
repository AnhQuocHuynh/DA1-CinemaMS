package com.uit.cinema.catalog.repository;

import com.uit.cinema.catalog.entity.Event;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface EventRepository extends JpaRepository<Event, Long> {

    List<Event> findByActiveTrueOrderByStartTimeAsc();

    List<Event> findByEndTimeAfterAndActiveTrueOrderByStartTimeAsc(LocalDateTime now);

    @Query("SELECT e FROM Event e " +
           "WHERE (CAST(:keyword AS text) IS NULL OR LOWER(e.name) LIKE LOWER(CONCAT('%', CAST(:keyword AS text), '%')) OR LOWER(e.description) LIKE LOWER(CONCAT('%', CAST(:keyword AS text), '%'))) " +
           "AND (CAST(:fromDate AS timestamp) IS NULL OR e.startTime >= :fromDate) " +
           "AND (CAST(:toDate AS timestamp) IS NULL OR e.endTime <= :toDate) " +
           "AND e.active = true " +
           "AND e.endTime >= :minEndTime")
    org.springframework.data.domain.Page<Event> searchEvents(
            @Param("keyword") String keyword,
            @Param("fromDate") java.time.LocalDateTime fromDate,
            @Param("toDate") java.time.LocalDateTime toDate,
            @Param("minEndTime") java.time.LocalDateTime minEndTime,
            org.springframework.data.domain.Pageable pageable
    );
}
