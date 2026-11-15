package com.api.moviebooking.repositories;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.api.moviebooking.models.entities.Movie;
import com.api.moviebooking.models.enums.MovieStatus;

public interface MovieRepo extends JpaRepository<Movie, UUID> {

    // Search movies by title
    List<Movie> findByTitleContainingIgnoreCase(String title);

    Optional<Movie> findByImdbId(String imdbId);

    boolean existsByImdbId(String imdbId);

    // Filter movies by status
    List<Movie> findByStatus(MovieStatus status);

    List<Movie> findTop1000ByStatusOrderByImdbRatingDesc(MovieStatus status);

    List<Movie> findByStatusAndIdNotInOrderByImdbRatingDesc(
            MovieStatus status,
            Collection<UUID> excludedMovieIds,
            Pageable pageable);

    // Filter movies by genre
    List<Movie> findByGenreContainingIgnoreCase(String genre);

    // Check if movie title already exists (for validation)
    boolean existsByTitleIgnoreCase(String title);

    // Search by title, genre, or status
    @Query("SELECT m FROM Movie m WHERE " +
           "(:title IS NULL OR LOWER(m.title) LIKE LOWER(CONCAT('%', :title, '%'))) AND " +
           "(:genre IS NULL OR LOWER(m.genre) LIKE LOWER(CONCAT('%', :genre, '%'))) AND " +
           "(:status IS NULL OR m.status = :status)")
    List<Movie> searchMovies(@Param("title") String title, 
                            @Param("genre") String genre, 
                            @Param("status") MovieStatus status);
}
