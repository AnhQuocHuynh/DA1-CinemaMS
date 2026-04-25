package com.uit.cinema.catalog.repository;

import com.uit.cinema.catalog.entity.Movie;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MovieRepository extends JpaRepository<Movie, Long> {

    List<Movie> findByActiveTrueOrderByReleaseDateDesc();

    @Query("SELECT m FROM Movie m JOIN m.genres g WHERE g.name = :genreName AND m.active = true")
    List<Movie> findByGenreName(String genreName);

    List<Movie> findByTitleContainingIgnoreCaseAndActiveTrue(String title);
}
