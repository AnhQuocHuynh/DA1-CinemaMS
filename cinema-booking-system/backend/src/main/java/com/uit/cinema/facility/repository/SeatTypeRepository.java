package com.uit.cinema.facility.repository;

import com.uit.cinema.facility.entity.SeatType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface SeatTypeRepository extends JpaRepository<SeatType, Long> {

    Optional<SeatType> findByNameIgnoreCase(String name);
}
