package com.uit.cinema.chatbot.ai;

import java.util.function.Consumer;

public interface LanguageModelPort {

    boolean available();

    String complete(String systemPrompt, String userPrompt);

    void stream(String systemPrompt, String userPrompt, Consumer<String> tokens);
}
