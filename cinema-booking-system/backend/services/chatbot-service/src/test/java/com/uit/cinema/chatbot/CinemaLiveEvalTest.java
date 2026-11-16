package com.uit.cinema.chatbot;

import com.uit.cinema.chatbot.service.KnowledgeIndexer;
import com.uit.cinema.chatbot.service.ReplyOrchestrator;
import com.uit.cinema.chatbot.persistence.KnowledgeSource;
import com.uit.cinema.chatbot.persistence.KnowledgeSourceRepository;
import com.uit.cinema.chatbot.persistence.SourceStatus;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

@EnabledIfEnvironmentVariable(named = "CHATBOT_LIVE_EVAL", matches = "true")
@SpringBootTest
@TestPropertySource(properties = {
    "cinema.ai.enabled=true",
    "cinema.ai.api-key=${GEMINI_API_KEY}",
    "cinema.chatbot.reindex-on-startup=false",
    "services.catalog.url=http://localhost:8081",
    "services.showtime.url=http://localhost:8082",
    "services.booking.url=http://localhost:8083",
    "services.recommendation.url=http://localhost:8085"
})
class CinemaLiveEvalTest {

    @Autowired
    private KnowledgeIndexer indexer;
    @Autowired
    private ReplyOrchestrator orchestrator;
    @Autowired
    private com.uit.cinema.chatbot.service.ConversationService conversations;
    @Autowired
    private KnowledgeSourceRepository sources;

    @Test
    @Timeout(value = 8, unit = TimeUnit.MINUTES)
    void catalogQuestionsStayGroundedAndOutsideQuestionsAreRefused() {
        indexer.reindex();
        String title = sources.findAll().stream()
            .filter(source -> source.getStatus() == SourceStatus.SUCCESS)
            .map(KnowledgeSource::getTitle)
            .filter(value -> value != null && !value.isBlank() && !value.equals("Hướng dẫn đặt vé"))
            .findFirst()
            .orElseThrow();
        var about = orchestrator.replySync(conversations.create(0L, "Eval").id(), 0L, title + " nói về điều gì?");
        assertFalse(about.citations().isEmpty());
        assertTrue(about.citations().stream().anyMatch(citation -> title.equals(citation.title())));
        assertFalse(about.content().equals("Mình chưa có thông tin này trong kho của rạp."));

        var guide = orchestrator.replySync(conversations.create(0L, "Eval").id(), 0L, "Làm sao để đặt vé?");
        assertTrue(guide.citations().stream().anyMatch(citation -> "guide/booking".equals(citation.locator())));

        var weather = orchestrator.replySync(conversations.create(0L, "Eval").id(), 0L, "Thời tiết hôm nay ở Hà Nội thế nào?");
        assertEquals("Mình chưa có thông tin này trong kho của rạp.", weather.content());
        assertTrue(weather.citations().isEmpty());

        var refund = orchestrator.replySync(conversations.create(0L, "Eval").id(), 0L, "Chính sách hoàn tiền của rạp là gì?");
        assertEquals("Mình chưa có thông tin này trong kho của rạp.", refund.content());
        assertTrue(refund.citations().isEmpty());
    }
}
