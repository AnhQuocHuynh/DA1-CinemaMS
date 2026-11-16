package com.uit.cinema.chatbot.service;

import java.util.List;

public interface BookingKnowledgeClient {

    List<String> linesForUser(long userId);
}
