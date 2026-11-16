package com.uit.cinema.chatbot.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.UUID;

@Data
@ConfigurationProperties(prefix = "cinema.chatbot")
public class ChatbotProperties {

    private UUID tenantId = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private int topK = 5;
    private double maxDistance = 0.40;
    private double relativeMargin = 0.08;
    private int citationMaxChars = 500;
    private int historyMessages = 10;
    private int historyChars = 4000;
    private boolean reindexOnStartup = true;
    private long devActorId = 0;
    private String refusal = "Mình chưa có thông tin này trong kho của rạp.";
    private String disabledReply = "Trợ lý đang tắt.";

    public UUID tenantId() {
        return tenantId;
    }
}
