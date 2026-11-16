package com.uit.cinema.chatbot.ai;

public final class EmbeddingDimensions {

    public static final int LENGTH = 768;

    private EmbeddingDimensions() {
    }

    public static void check(float[] vector) {
        int actual = vector == null ? 0 : vector.length;
        if (actual != LENGTH) {
            throw new IllegalStateException("Embedding length " + actual + " != " + LENGTH);
        }
    }
}
