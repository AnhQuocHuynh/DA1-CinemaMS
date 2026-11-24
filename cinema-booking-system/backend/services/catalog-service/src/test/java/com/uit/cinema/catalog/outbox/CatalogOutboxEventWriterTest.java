package com.uit.cinema.catalog.outbox;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.uit.cinema.catalog.entity.Genre;
import com.uit.cinema.catalog.entity.Movie;
import com.uit.cinema.core.outbox.TransactionalOutbox;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class CatalogOutboxEventWriterTest {

    @Mock
    private TransactionalOutbox transactionalOutbox;

    @Captor
    private ArgumentCaptor<Object> payloadCaptor;

    @Test
    void movieUpdated_includesCatalogMetadataFieldsInPayload() throws Exception {
        Genre sciFi = Genre.builder()
            .id(1L)
            .name("Sci-Fi")
            .build();

        Movie movie = Movie.builder()
            .id(42L)
            .title("Inception")
            .description("A thief who steals corporate secrets through dream-sharing.")
            .aiSummary("Dream heist thriller.")
            .durationMinutes(148)
            .releaseDate(LocalDate.of(2010, 7, 16))
            .ageRating("T13")
            .posterUrl("https://cdn.example/inception.jpg")
            .trailerUrl("https://cdn.example/inception.mp4")
            .language("English")
            .imdbId("tt1375666")
            .imdbRating(8.8)
            .region("USA")
            .director("Christopher Nolan")
            .actors("Leonardo DiCaprio, Elliot Page")
            .active(true)
            .genres(Set.of(sciFi))
            .build();

        CatalogOutboxEventWriter writer = new CatalogOutboxEventWriter(transactionalOutbox);
        writer.movieUpdated(movie);

        verify(transactionalOutbox).append(
            eq("catalog-service"),
            eq("catalog.events"),
            eq("movie.updated"),
            eq("movie"),
            eq(42L),
            payloadCaptor.capture()
        );

        ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();
        String jsonString = objectMapper.writeValueAsString(payloadCaptor.getValue());
        JsonNode json = objectMapper.readTree(jsonString);

        assertEquals(42L, json.get("movieId").asLong());
        assertEquals("Inception", json.get("title").asText());
        assertEquals("Sci-Fi", json.get("genreNames").get(0).asText());
        assertEquals("Christopher Nolan", json.get("director").asText());
        assertEquals("Leonardo DiCaprio, Elliot Page", json.get("actors").asText());
        assertEquals(8.8, json.get("imdbRating").asDouble());
        assertEquals("USA", json.get("region").asText());
        assertEquals("Dream heist thriller.", json.get("aiSummary").asText());
        assertEquals("tt1375666", json.get("imdbId").asText());
        assertEquals("https://cdn.example/inception.mp4", json.get("trailerUrl").asText());
        assertEquals(
            "A thief who steals corporate secrets through dream-sharing.",
            json.get("description").asText()
        );
    }
}
