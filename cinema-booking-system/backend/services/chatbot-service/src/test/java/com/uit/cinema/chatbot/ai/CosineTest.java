package com.uit.cinema.chatbot.ai;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CosineTest {

    @Test
    void identicalVectorsHaveZeroDistance() {
        float[] vector = TestVectors.ones();
        assertEquals(0d, Cosine.distance(vector, vector), 0.0001);
    }

    @Test
    void orthogonalVectorsAreFartherThanTheDefaultThreshold() {
        assertTrue(Cosine.distance(TestVectors.axis(0), TestVectors.axis(1)) > 0.55);
    }
}
