package com.uit.cinema.catalog;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.uit.cinema.catalog.dto.request.MovieRequest;
import com.uit.cinema.catalog.entity.Genre;
import com.uit.cinema.catalog.entity.Movie;
import com.uit.cinema.catalog.repository.GenreRepository;
import com.uit.cinema.catalog.repository.MovieRepository;
import com.uit.cinema.catalog.service.MovieSummaryAgent;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = "app.internal-token=test-internal-token")
@AutoConfigureMockMvc
@ActiveProfiles("test")
@WithMockUser(roles = "ADMIN")
class MovieSummaryE2ETest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private MovieRepository movieRepository;

    @Autowired
    private GenreRepository genreRepository;

    @MockBean
    private MovieSummaryAgent movieSummaryAgent;

    private Genre testGenre;

    @BeforeEach
    void setUp() {
        movieRepository.deleteAll();
        genreRepository.deleteAll();
        reset(movieSummaryAgent);

        testGenre = genreRepository.save(Genre.builder().name("Sci-Fi").build());
    }

    @Test
    void createMovie_withDescription_fetchesAiSummaryAndSavesToDb() throws Exception {
        when(movieSummaryAgent.summarize(eq("Inception"), eq("A thief enters dreams to steal secrets."), anyList()))
            .thenReturn(Optional.of("A skilled extractor enters dreams to plant an idea."));

        MovieRequest request = new MovieRequest();
        request.setTitle("Inception");
        request.setDescription("A thief enters dreams to steal secrets.");
        request.setDurationMinutes(148);
        request.setReleaseDate(LocalDate.of(2010, 7, 16));
        request.setGenreIds(Set.of(testGenre.getId()));

        MvcResult result = mockMvc.perform(post("/api/movies")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.data.title").value("Inception"))
            .andExpect(jsonPath("$.data.aiSummary").value("A skilled extractor enters dreams to plant an idea."))
            .andReturn();

        JsonNode responseJson = objectMapper.readTree(result.getResponse().getContentAsString());
        long movieId = responseJson.path("data").path("id").asLong();

        // Verify GET /api/movies/{id} retrieves the persisted aiSummary
        mockMvc.perform(get("/api/movies/{id}", movieId))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.aiSummary").value("A skilled extractor enters dreams to plant an idea."));

        // Verify database persistence directly
        Movie saved = movieRepository.findById(movieId).orElseThrow();
        assertThat(saved.getAiSummary()).isEqualTo("A skilled extractor enters dreams to plant an idea.");
    }

    @Test
    void updateMovie_whenDescriptionChanged_refreshesAiSummary() throws Exception {
        when(movieSummaryAgent.summarize(eq("Interstellar"), eq("Original plot description."), anyList()))
            .thenReturn(Optional.of("Initial summary."));

        MovieRequest createReq = new MovieRequest();
        createReq.setTitle("Interstellar");
        createReq.setDescription("Original plot description.");
        createReq.setDurationMinutes(169);
        createReq.setGenreIds(Set.of(testGenre.getId()));

        MvcResult createResult = mockMvc.perform(post("/api/movies")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(createReq)))
            .andExpect(status().isOk())
            .andReturn();

        long movieId = objectMapper.readTree(createResult.getResponse().getContentAsString())
            .path("data").path("id").asLong();

        // Configure agent for updated description
        when(movieSummaryAgent.summarize(eq("Interstellar"), eq("Astronauts travel through a wormhole."), anyList()))
            .thenReturn(Optional.of("Astronauts journey beyond the galaxy to ensure humanity's survival."));

        MovieRequest updateReq = new MovieRequest();
        updateReq.setTitle("Interstellar");
        updateReq.setDescription("Astronauts travel through a wormhole.");
        updateReq.setDurationMinutes(169);
        updateReq.setGenreIds(Set.of(testGenre.getId()));

        mockMvc.perform(put("/api/movies/{id}", movieId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(updateReq)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.aiSummary").value("Astronauts journey beyond the galaxy to ensure humanity's survival."));

        // Check DB has the updated AI summary
        Movie updated = movieRepository.findById(movieId).orElseThrow();
        assertThat(updated.getAiSummary()).isEqualTo("Astronauts journey beyond the galaxy to ensure humanity's survival.");
    }

    @Test
    void updateMovie_whenDescriptionUnchanged_retainsAiSummaryWithoutCallingAgent() throws Exception {
        when(movieSummaryAgent.summarize(eq("Tenet"), eq("Time inversion story."), anyList()))
            .thenReturn(Optional.of("Protagonist manipulates time flow."));

        MovieRequest createReq = new MovieRequest();
        createReq.setTitle("Tenet");
        createReq.setDescription("Time inversion story.");
        createReq.setDurationMinutes(150);
        createReq.setGenreIds(Set.of(testGenre.getId()));

        MvcResult createResult = mockMvc.perform(post("/api/movies")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(createReq)))
            .andExpect(status().isOk())
            .andReturn();

        long movieId = objectMapper.readTree(createResult.getResponse().getContentAsString())
            .path("data").path("id").asLong();

        reset(movieSummaryAgent);

        // Update other fields, keeping description identical
        MovieRequest updateReq = new MovieRequest();
        updateReq.setTitle("Tenet (Updated Title)");
        updateReq.setDescription("Time inversion story.");
        updateReq.setDurationMinutes(152);
        updateReq.setGenreIds(Set.of(testGenre.getId()));

        mockMvc.perform(put("/api/movies/{id}", movieId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(updateReq)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.title").value("Tenet (Updated Title)"))
            .andExpect(jsonPath("$.data.aiSummary").value("Protagonist manipulates time flow."));

        verify(movieSummaryAgent, never()).summarize(anyString(), anyString(), anyList());

        Movie updated = movieRepository.findById(movieId).orElseThrow();
        assertThat(updated.getAiSummary()).isEqualTo("Protagonist manipulates time flow.");
    }

    @Test
    void updateMovie_whenDescriptionCleared_clearsAiSummary() throws Exception {
        when(movieSummaryAgent.summarize(eq("Memento"), eq("Man with memory loss."), anyList()))
            .thenReturn(Optional.of("A man tracks his wife's killer using tattoos."));

        MovieRequest createReq = new MovieRequest();
        createReq.setTitle("Memento");
        createReq.setDescription("Man with memory loss.");
        createReq.setDurationMinutes(113);
        createReq.setGenreIds(Set.of(testGenre.getId()));

        MvcResult createResult = mockMvc.perform(post("/api/movies")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(createReq)))
            .andExpect(status().isOk())
            .andReturn();

        long movieId = objectMapper.readTree(createResult.getResponse().getContentAsString())
            .path("data").path("id").asLong();

        MovieRequest updateReq = new MovieRequest();
        updateReq.setTitle("Memento");
        updateReq.setDescription(""); // blanked
        updateReq.setDurationMinutes(113);
        updateReq.setGenreIds(Set.of(testGenre.getId()));

        mockMvc.perform(put("/api/movies/{id}", movieId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(updateReq)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.aiSummary").doesNotExist());

        Movie updated = movieRepository.findById(movieId).orElseThrow();
        assertThat(updated.getAiSummary()).isNull();
    }

    @Test
    void createMovie_whenAgentThrowsException_gracefullyCreatesMovieWithNullSummary() throws Exception {
        when(movieSummaryAgent.summarize(anyString(), anyString(), anyList()))
            .thenThrow(new RuntimeException("Gemini API service unavailable"));

        MovieRequest request = new MovieRequest();
        request.setTitle("Dune");
        request.setDescription("Desert planet spice conflict.");
        request.setDurationMinutes(155);
        request.setGenreIds(Set.of(testGenre.getId()));

        mockMvc.perform(post("/api/movies")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.data.title").value("Dune"))
            .andExpect(jsonPath("$.data.aiSummary").doesNotExist());

        Movie saved = movieRepository.findAll().stream()
            .filter(m -> "Dune".equals(m.getTitle()))
            .findFirst()
            .orElseThrow();
        assertThat(saved.getAiSummary()).isNull();
    }

    @Test
    void createMovie_whenDescriptionIsBlank_doesNotCallAgent() throws Exception {
        MovieRequest request = new MovieRequest();
        request.setTitle("Silent Film");
        request.setDescription("   ");
        request.setDurationMinutes(90);

        mockMvc.perform(post("/api/movies")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.aiSummary").doesNotExist());

        verify(movieSummaryAgent, never()).summarize(any(), any(), any());
    }
}
