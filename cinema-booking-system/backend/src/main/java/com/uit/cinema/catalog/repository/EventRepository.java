package com.uit.cinema.catalog.repository;

import com.uit.cinema.catalog.entity.Event;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface EventRepository extends JpaRepository<Event, Long> {

    List<Event> findByActiveTrueOrderByStartTimeAsc();

    List<Event> findByStartTimeAfterAndActiveTrue(LocalDateTime now);
}
