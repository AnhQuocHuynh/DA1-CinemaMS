package com.uit.cinema.chatbot.service;

import java.util.List;

public interface CatalogKnowledgeClient {

    List<CatalogDocument> listMovies();

    List<CatalogDocument> listEvents();
}
