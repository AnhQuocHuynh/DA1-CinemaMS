package com.uit.cinema.chatbot.ai;

import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

@Component
public class TextSplitter {

    static final int WINDOW = 1000;
    static final int OVERLAP = 150;

    public List<String> split(String text) {
        if (text == null) {
            return List.of();
        }
        String normalized = text.replace("\r\n", "\n").trim();
        if (normalized.isEmpty()) {
            return List.of();
        }
        List<String> chunks = new ArrayList<>();
        int start = 0;
        while (start < normalized.length()) {
            int end = Math.min(start + WINDOW, normalized.length());
            if (end < normalized.length()) {
                int breakAt = normalized.lastIndexOf('\n', end);
                if (breakAt > start + WINDOW / 2) {
                    end = breakAt;
                }
            }
            String chunk = normalized.substring(start, end).trim();
            if (!chunk.isEmpty()) {
                chunks.add(chunk);
            }
            if (end >= normalized.length()) {
                break;
            }
            int next = Math.max(end - OVERLAP, start + 1);
            if (next <= start) {
                next = end;
            }
            start = next;
        }
        return chunks;
    }

    public List<String> splitWithHeading(String text, String heading) {
        List<String> chunks = split(text);
        if (heading == null || heading.isBlank()) {
            return chunks;
        }
        String line = heading.trim();
        List<String> headed = new ArrayList<>();
        for (String chunk : chunks) {
            headed.add(chunk.startsWith(line) ? chunk : line + "\n" + chunk);
        }
        return headed;
    }
}
