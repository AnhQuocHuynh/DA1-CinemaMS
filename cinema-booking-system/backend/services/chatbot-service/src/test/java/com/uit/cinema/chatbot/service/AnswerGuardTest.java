package com.uit.cinema.chatbot.service;

import com.uit.cinema.chatbot.ai.EmbeddingDimensions;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AnswerGuardTest {

    @Test
    void dropsEmojiAndForeignTitles() {
        assertEquals("Xin chao", AnswerGuard.stripEmoji("Xin chao 😀"));
        assertFalse(AnswerGuard.hasLetterOrDigit("???"));
        assertTrue(AnswerGuard.mentionsForeignTitle(
            "Dune: Part Two cũng đáng xem.",
            "Inception nói về gì",
            List.of("Inception", "Dune: Part Two")
        ));
        assertFalse(AnswerGuard.mentionsForeignTitle(
            "Inception kể về giấc mơ.",
            "Inception nói về gì",
            List.of("Inception", "Dune: Part Two")
        ));
    }

    @Test
    void marginKeepsOnlyCloseNeighbors() {
        var hits = List.of(
            hit("gan", 0.10),
            hit("vua", 0.16),
            hit("xa", 0.30)
        );
        var kept = JavaCosineRetrieval.withinMargin(hits, 0.08, 5);
        assertEquals(2, kept.size());
        assertEquals("gan", kept.get(0).text());
        assertEquals("vua", kept.get(1).text());
        assertEquals(768, EmbeddingDimensions.LENGTH);
    }

    private static PassageHit hit(String text, double distance) {
        return new PassageHit(null, null, text, "", text, "{}", distance);
    }
}
