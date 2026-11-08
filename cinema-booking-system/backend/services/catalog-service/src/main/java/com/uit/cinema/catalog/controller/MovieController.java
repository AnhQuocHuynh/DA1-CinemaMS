package com.uit.cinema.catalog.controller;

import com.uit.cinema.catalog.dto.imdb.ImdbTitleDTO;
import com.uit.cinema.catalog.dto.request.MovieRequest;
import com.uit.cinema.catalog.dto.response.MovieResponse;
import com.uit.cinema.catalog.entity.Movie;
import com.uit.cinema.catalog.mapper.MovieMapper;
import com.uit.cinema.catalog.service.Impl.ImdbSyncService;
import com.uit.cinema.catalog.service.Impl.MovieBulkImportService;
import com.uit.cinema.catalog.service.MovieService;
import com.uit.cinema.core.dto.response.ApiResponse;
import com.uit.cinema.core.exception.CustomException;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/movies")
@RequiredArgsConstructor
public class MovieController {

    private final MovieService movieService;
    private final MovieMapper movieMapper;
    private final ImdbSyncService imdbSyncService;
    private final MovieBulkImportService movieBulkImportService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<MovieResponse>>> getAllMovies() {
        List<MovieResponse> movies = movieService.getAllActiveMovies();
        return ResponseEntity.ok(ApiResponse.success(movies, "Lấy danh sách phim thành công"));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<MovieResponse>> getMovieById(@PathVariable Long id) {
        MovieResponse movie = movieService.getMovieById(id);
        return ResponseEntity.ok(ApiResponse.success(movie, "Lấy thông tin phim thành công"));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<MovieResponse>> createMovie(@Valid @RequestBody MovieRequest request) {
        MovieResponse movie = movieService.createMovie(request);
        return ResponseEntity.ok(ApiResponse.success(movie, "Tạo phim mới thành công"));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<MovieResponse>> updateMovie(@PathVariable Long id, @Valid @RequestBody MovieRequest request) {
        MovieResponse movie = movieService.updateMovie(id, request);
        return ResponseEntity.ok(ApiResponse.success(movie, "Cập nhật phim thành công"));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Void>> deleteMovie(@PathVariable Long id) {
        movieService.deleteMovie(id);
        return ResponseEntity.ok(ApiResponse.success(null, "Xóa phim thành công"));
    }

    @GetMapping("/imdb/titles")
    public ResponseEntity<ApiResponse<List<ImdbTitleDTO>>> imdbTitles(
            @RequestParam(required = false) String query,
            @RequestParam(required = false) Integer limit
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                imdbSyncService.getTitlesFromImdb(query, limit),
                "IMDb titles loaded"));
    }

    @PostMapping("/imdb-sync/{imdbId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<MovieResponse>> syncFromImdb(@PathVariable String imdbId) {
        Movie movie = imdbSyncService.syncMovieByImdbId(imdbId);
        return ResponseEntity.ok(ApiResponse.success(movieMapper.toResponse(movie), "IMDb sync completed"));
    }

    @PostMapping("/bulk-import")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> bulkImport(
            @RequestParam String genre,
            @RequestParam(defaultValue = "20") int limit
    ) {
        if (genre == null || genre.isBlank()) {
            throw new CustomException("genre must not be blank", HttpStatus.BAD_REQUEST, "GENRE_REQUIRED");
        }
        int normalizedLimit = movieBulkImportService.clampLimit(limit);
        movieBulkImportService.importMoviesByGenre(genre.trim(), normalizedLimit);
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(ApiResponse.success(
                Map.of("message", "Bulk import started in background", "genre", genre.trim(), "limit", normalizedLimit),
                "Bulk import started"));
    }
}
