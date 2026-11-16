package com.uit.cinema.chatbot.ai;

import java.util.List;

public interface EmbeddingPort {

    boolean available();

    float[] embed(String text);

    List<float[]> embedAll(List<String> texts);
}
