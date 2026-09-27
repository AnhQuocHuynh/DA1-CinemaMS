package com.uit.cinema.catalog.repository;

import com.uit.cinema.catalog.entity.Movie;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import org.springframework.data.repository.query.Param;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Page;

import java.util.List;
import java.time.LocalDate;

@Repository
public interface MovieRepository extends JpaRepository<Movie, Long> {

    List<Movie> findByActiveTrueOrderByReleaseDateDesc();

    @Query("SELECT m FROM Movie m JOIN m.genres g WHERE g.name = :genreName AND m.active = true")
    List<Movie> findByGenreName(String genreName);

    List<Movie> findByTitleContainingIgnoreCaseAndActiveTrue(String title);

    @Query("SELECT DISTINCT m FROM Movie m LEFT JOIN m.genres g " +
           "WHERE (CAST(:keyword AS text) IS NULL OR LOWER(m.title) LIKE LOWER(CONCAT('%', CAST(:keyword AS text), '%')) OR LOWER(m.description) LIKE LOWER(CONCAT('%', CAST(:keyword AS text), '%'))) " +
           "AND (CAST(:genreId AS long) IS NULL OR g.id = :genreId) " +
           "AND (CAST(:fromDate AS date) IS NULL OR m.releaseDate >= :fromDate) " +
           "AND (CAST(:toDate AS date) IS NULL OR m.releaseDate <= :toDate) " +
           "AND m.active = true")
    Page<Movie> searchMovies(
            @Param("keyword") String keyword,
            @Param("genreId") Long genreId,
            @Param("fromDate") LocalDate fromDate,
            @Param("toDate") LocalDate toDate,
            Pageable pageable
    );
}
