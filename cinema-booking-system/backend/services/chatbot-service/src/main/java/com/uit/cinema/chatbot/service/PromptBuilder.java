package com.uit.cinema.chatbot.service;

import com.uit.cinema.chatbot.persistence.ChatMessage;
import com.uit.cinema.chatbot.persistence.Sender;

import java.util.List;

public final class PromptBuilder {

    private PromptBuilder() {
    }

    public static String systemPrompt() {
        return """
            Bạn là trợ lý của một rạp chiếu phim. Trả lời tiếng Việt, ngắn, chỉ dựa trên đoạn tài liệu và fact live trong tin nhắn người dùng.
            Nếu thông tin không có trong đó, nói rõ là bạn không có thông tin này. Không bịa suất chiếu, giá vé, hay chính sách hoàn tiền.
            Không đặt vé và không thanh toán hộ khách. Không dùng emoji.
            """;
    }

    public static String userPrompt(List<ChatMessage> history, List<PassageHit> passages, List<String> liveFacts, String question, int historyCharBudget) {
        StringBuilder builder = new StringBuilder();
        builder.append("Lịch sử:\n");
        java.util.ArrayList<String> lines = new java.util.ArrayList<>();
        int used = 0;
        int counted = 0;
        for (int i = history.size() - 1; i >= 0 && counted < 10; i--) {
            ChatMessage message = history.get(i);
            String line = (message.getSender() == Sender.USER ? "Khách: " : "Trợ lý: ") + message.getContent();
            if (used + line.length() > historyCharBudget) {
                break;
            }
            lines.add(0, line);
            used += line.length();
            counted++;
        }
        for (String line : lines) {
            builder.append(line).append('\n');
        }
        builder.append("\nTài liệu:\n");
        if (passages.isEmpty()) {
            builder.append("(không có)\n");
        }
        for (PassageHit passage : passages) {
            builder.append("[passage ").append(passage.passageId()).append("] ");
            builder.append(passage.title()).append('\n');
            builder.append(passage.text()).append("\n\n");
        }
        builder.append("Fact live:\n");
        if (liveFacts == null || liveFacts.isEmpty()) {
            builder.append("(không có)\n");
        } else {
            for (String fact : liveFacts) {
                builder.append("- ").append(fact).append('\n');
            }
        }
        builder.append("\nCâu hỏi:\n").append(question);
        return builder.toString();
    }
}
