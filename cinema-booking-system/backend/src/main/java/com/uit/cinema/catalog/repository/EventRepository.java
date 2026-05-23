package com.uit.cinema.catalog.repository;

import com.uit.cinema.catalog.entity.Event;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface EventRepository extends JpaRepository<Event, Long> {

    List<Event> findByActiveTrueOrderByStartTimeAsc();

    List<Event> findByStartTimeAfterAndActiveTrue(LocalDateTime now);

    @Query("SELECT e FROM Event e " +
           "WHERE (:keyword IS NULL OR LOWER(e.name) LIKE LOWER(CONCAT('%', :keyword, '%')) OR LOWER(e.description) LIKE LOWER(CONCAT('%', :keyword, '%'))) " +
           "AND (CAST(:fromDate AS timestamp) IS NULL OR e.startTime >= :fromDate) " +
           "AND (CAST(:toDate AS timestamp) IS NULL OR e.endTime <= :toDate) " +
           "AND e.active = true " +
           "AND e.endTime >= :minEndTime")
    org.springframework.data.domain.Page<Event> searchEvents(
            @org.springframework.data.repository.query.Param("keyword") String keyword,
            @org.springframework.data.repository.query.Param("fromDate") java.time.LocalDateTime fromDate,
            @org.springframework.data.repository.query.Param("toDate") java.time.LocalDateTime toDate,
            @org.springframework.data.repository.query.Param("minEndTime") java.time.LocalDateTime minEndTime,
            org.springframework.data.domain.Pageable pageable
    );
}
