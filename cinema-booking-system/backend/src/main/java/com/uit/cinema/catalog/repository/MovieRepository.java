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

    @Query("SELECT DISTINCT m FROM Movie m LEFT JOIN m.genres g " +
           "WHERE (:keyword IS NULL OR LOWER(m.title) LIKE LOWER(CONCAT('%', :keyword, '%')) OR LOWER(m.description) LIKE LOWER(CONCAT('%', :keyword, '%'))) " +
           "AND (:genreId IS NULL OR g.id = :genreId) " +
           "AND (:fromDate IS NULL OR m.releaseDate >= :fromDate) " +
           "AND (:toDate IS NULL OR m.releaseDate <= :toDate) " +
           "AND m.active = true")
    org.springframework.data.domain.Page<Movie> searchMovies(
            @org.springframework.data.repository.query.Param("keyword") String keyword,
            @org.springframework.data.repository.query.Param("genreId") Long genreId,
            @org.springframework.data.repository.query.Param("fromDate") java.time.LocalDate fromDate,
            @org.springframework.data.repository.query.Param("toDate") java.time.LocalDate toDate,
            org.springframework.data.domain.Pageable pageable
    );
}
