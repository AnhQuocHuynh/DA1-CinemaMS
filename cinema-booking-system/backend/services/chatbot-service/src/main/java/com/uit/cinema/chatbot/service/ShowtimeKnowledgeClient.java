package com.uit.cinema.chatbot.service;

import java.util.List;

public interface ShowtimeKnowledgeClient {

    List<String> linesForMovie(long movieId);

    List<String> linesForEvent(long eventId);
}
