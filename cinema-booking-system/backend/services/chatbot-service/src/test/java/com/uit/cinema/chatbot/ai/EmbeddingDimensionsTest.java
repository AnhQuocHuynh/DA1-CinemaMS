package com.uit.cinema.chatbot.ai;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class EmbeddingDimensionsTest {

    @Test
    void constantIs768AndGuardRejectsOtherLengths() {
        assertEquals(768, EmbeddingDimensions.LENGTH);
        assertDoesNotThrow(() -> EmbeddingDimensions.check(TestVectors.ones()));
        assertThrows(IllegalStateException.class, () -> EmbeddingDimensions.check(new float[10]));
    }
}
