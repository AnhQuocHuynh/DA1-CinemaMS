package com.uit.cinema.catalog.controller;

import com.uit.cinema.catalog.dto.response.CatalogSearchResponse;
import com.uit.cinema.catalog.service.CatalogService;
import com.uit.cinema.core.dto.response.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/catalog")
@RequiredArgsConstructor
public class CatalogController {

    private final CatalogService catalogService;

    @GetMapping("/search")
    public ResponseEntity<ApiResponse<CatalogSearchResponse>> search(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Long genreId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        CatalogSearchResponse response = catalogService.search(keyword, genreId, fromDate, toDate, page, size);
        return ResponseEntity.ok(ApiResponse.success(response, "Tìm kiếm danh mục thành công"));
    }
}
