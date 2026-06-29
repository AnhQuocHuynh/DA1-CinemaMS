package com.uit.cinema.facility.repository;

import com.uit.cinema.facility.entity.Cinema;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CinemaRepository extends JpaRepository<Cinema, Long> {

    List<Cinema> findByActiveTrue();

    List<Cinema> findByCityAndActiveTrue(String city);
}
