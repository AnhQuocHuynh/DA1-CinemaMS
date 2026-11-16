package com.uit.cinema.chatbot.ai;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertTrue;

class TextSplitterTest {

    private final TextSplitter splitter = new TextSplitter();

    @Test
    void blankTextProducesNoChunks() {
        assertTrue(splitter.split("  \n ").isEmpty());
    }

    @Test
    void longTextOverlaps() {
        String text = "a".repeat(2500);
        var chunks = splitter.split(text);
        assertTrue(chunks.size() > 1);
        assertTrue(chunks.get(0).length() <= TextSplitter.WINDOW);
        assertTrue(chunks.get(1).startsWith("a"));
    }

    @Test
    void secondChunkKeepsTheTitle() {
        String text = "Mo ta.\n" + "a".repeat(1200);
        var chunks = splitter.splitWithHeading(text, "Tiêu đề: Inception");
        assertTrue(chunks.size() > 1);
        assertTrue(chunks.get(0).startsWith("Tiêu đề: Inception"));
        assertTrue(chunks.get(1).startsWith("Tiêu đề: Inception"));
        assertTrue(chunks.get(0).indexOf("Tiêu đề: Inception") == chunks.get(0).lastIndexOf("Tiêu đề: Inception"));
    }
}
