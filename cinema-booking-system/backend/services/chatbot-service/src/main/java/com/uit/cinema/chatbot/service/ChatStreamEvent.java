package com.uit.cinema.chatbot.service;

import java.util.List;

public record ChatStreamEvent(String type, String content, List<Citation> citations, String message) {

    public static ChatStreamEvent token(String content) {
        return new ChatStreamEvent("token", content, null, null);
    }

    public static ChatStreamEvent citations(List<Citation> citations) {
        return new ChatStreamEvent("citations", null, citations, null);
    }

    public static ChatStreamEvent done() {
        return new ChatStreamEvent("done", null, null, null);
    }

    public static ChatStreamEvent error(String message) {
        return new ChatStreamEvent("error", null, null, message);
    }
}
