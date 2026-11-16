package com.uit.cinema.chatbot.ai;

public final class TestVectors {

    private TestVectors() {
    }

    public static float[] ones() {
        float[] values = new float[EmbeddingDimensions.LENGTH];
        for (int i = 0; i < values.length; i++) {
            values[i] = 1f;
        }
        return values;
    }

    public static float[] axis(int index) {
        float[] values = new float[EmbeddingDimensions.LENGTH];
        values[index] = 1f;
        return values;
    }
}
