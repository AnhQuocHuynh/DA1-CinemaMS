package com.uit.cinema.recommendation.messaging;

import com.fasterxml.jackson.databind.JsonNode;

public interface RecommendationEventProjectionStore {

    boolean project(JsonNode envelope);
}
