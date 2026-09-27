package com.uit.cinema.facility.repository;

import com.uit.cinema.facility.entity.SeatTemplate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Repository
public interface SeatTemplateRepository extends JpaRepository<SeatTemplate, Long> {

    List<SeatTemplate> findByRoomIdAndActiveTrue(Long roomId);
    List<SeatTemplate> findByRoomId(Long roomId);
    
    @Modifying(clearAutomatically = true)
    @Transactional
    @Query("DELETE FROM SeatTemplate s WHERE s.room.id = :roomId")
    void deleteByRoomId(@Param("roomId") Long roomId);
}
