package com.uit.cinema.catalog.outbox;

import com.uit.cinema.catalog.entity.Genre;
import com.uit.cinema.catalog.entity.Movie;
import com.uit.cinema.core.outbox.TransactionalOutbox;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
public class CatalogOutboxEventWriter {

    private static final String SOURCE = "catalog-service";
    private static final String EXCHANGE = "catalog.events";
    private static final String AGGREGATE_TYPE = "movie";

    private final TransactionalOutbox transactionalOutbox;

    public void movieCreated(Movie movie) {
        append("movie.created", movie);
    }

    public void movieUpdated(Movie movie) {
        append("movie.updated", movie);
    }

    public void movieDeleted(Movie movie) {
        append("movie.deleted", movie);
    }

    private void append(String routingKey, Movie movie) {
        transactionalOutbox.append(
            SOURCE,
            EXCHANGE,
            routingKey,
            AGGREGATE_TYPE,
            movie.getId(),
            MoviePayload.from(movie)
        );
    }

    private record MoviePayload(
        Long movieId,
        String title,
        Integer durationMinutes,
        LocalDate releaseDate,
        String ageRating,
        String language,
        boolean active,
        List<Long> genreIds,
        List<String> genreNames,
        String posterUrl
    ) {
        private static MoviePayload from(Movie movie) {
            List<Genre> genres = movie.getGenres().stream()
                .sorted(Comparator.comparing(Genre::getId))
                .toList();
            return new MoviePayload(
                movie.getId(),
                movie.getTitle(),
                movie.getDurationMinutes(),
                movie.getReleaseDate(),
                movie.getAgeRating(),
                movie.getLanguage(),
                movie.isActive(),
                genres.stream().map(Genre::getId).toList(),
                genres.stream().map(Genre::getName).toList(),
                movie.getPosterUrl()
            );
        }
    }
}

