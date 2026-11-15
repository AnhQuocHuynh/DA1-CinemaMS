package com.uit.cinema.recommendation.client;

import com.uit.cinema.recommendation.uncertainty.MovieFeature;

import java.util.List;

public interface CatalogFeatureClient {

    List<MovieFeature> loadAll();

    MovieFeature requireFeature(Long movieId);
}
