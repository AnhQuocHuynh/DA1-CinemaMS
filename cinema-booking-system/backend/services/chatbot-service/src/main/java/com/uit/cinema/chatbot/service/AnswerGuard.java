package com.uit.cinema.chatbot.service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

public final class AnswerGuard {

    private AnswerGuard() {
    }

    public static boolean hasLetterOrDigit(String text) {
        return text != null && text.codePoints().anyMatch(Character::isLetterOrDigit);
    }

    public static String stripEmoji(String text) {
        if (text == null || text.isEmpty()) {
            return "";
        }
        StringBuilder builder = new StringBuilder();
        text.codePoints().filter(codePoint -> !isEmoji(codePoint)).forEach(builder::appendCodePoint);
        return builder.toString().trim();
    }

    public static String clipCitation(String text, int maxChars) {
        if (text == null || text.isBlank() || maxChars <= 0) {
            return "";
        }
        String trimmed = text.trim();
        if (trimmed.length() <= maxChars) {
            return trimmed;
        }
        int breakAt = trimmed.lastIndexOf('\n', maxChars);
        if (breakAt >= maxChars / 2) {
            return trimmed.substring(0, breakAt).trim();
        }
        return trimmed.substring(0, maxChars).trim();
    }

    public static boolean mentionsForeignTitle(String answer, String allowedText, List<String> catalogTitles) {
        String foldedAnswer = fold(answer);
        String foldedAllowed = fold(allowedText);
        List<String> titles = new ArrayList<>();
        for (String title : catalogTitles) {
            String folded = fold(title);
            if (letterOrDigitCount(folded) >= 4 && !titles.contains(folded)) {
                titles.add(folded);
            }
        }
        titles.sort(Comparator.comparingInt(String::length).reversed());
        String remaining = foldedAnswer;
        for (String title : titles) {
            if (foldedAllowed.contains(title)) {
                remaining = remaining.replace(title, " ");
            }
        }
        for (String title : titles) {
            if (!foldedAllowed.contains(title) && remaining.contains(title)) {
                return true;
            }
        }
        return false;
    }

    static String fold(String value) {
        String lower = value == null ? "" : value.toLowerCase(Locale.ROOT);
        return lower
            .replace('đ', 'd')
            .replaceAll("[áàảãạăắằẳẵặâấầẩẫậ]", "a")
            .replaceAll("[éèẻẽẹêếềểễệ]", "e")
            .replaceAll("[íìỉĩị]", "i")
            .replaceAll("[óòỏõọôốồổỗộơớờởỡợ]", "o")
            .replaceAll("[úùủũụưứừửữự]", "u")
            .replaceAll("[ýỳỷỹỵ]", "y")
            .replaceAll("\\s+", " ")
            .trim();
    }

    private static int letterOrDigitCount(String text) {
        return (int) text.codePoints().filter(Character::isLetterOrDigit).count();
    }

    private static boolean isEmoji(int codePoint) {
        return codePoint == 0x200D
            || codePoint == 0xFE0F
            || (codePoint >= 0x2600 && codePoint <= 0x27BF)
            || (codePoint >= 0x1F000 && codePoint <= 0x1FAFF);
    }
}
