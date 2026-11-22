package com.uit.cinema.catalog.service;

import java.util.List;
import java.util.Optional;

public interface MovieSummaryAgent {

    Optional<String> summarize(String title, String description, List<String> genres);
}
