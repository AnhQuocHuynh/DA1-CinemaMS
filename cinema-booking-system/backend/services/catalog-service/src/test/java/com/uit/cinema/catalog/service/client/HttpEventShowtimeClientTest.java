package com.uit.cinema.catalog.service.client;

import com.uit.cinema.core.exception.CustomException;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class HttpEventShowtimeClientTest {

    @Test
    void createForEvent_SendsInternalTokenAndCommandBody() {
        RestClient.Builder builder = RestClient.builder()
            .baseUrl("http://showtime-service")
            .defaultHeader("X-Internal-Token", "secret");
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        HttpEventShowtimeClient client = new HttpEventShowtimeClient(builder.build());
        LocalDateTime startTime = LocalDateTime.of(2026, 7, 10, 10, 0);
        LocalDateTime endTime = LocalDateTime.of(2026, 7, 10, 12, 0);

        server.expect(requestTo("http://showtime-service/internal/showtimes/events"))
            .andExpect(method(HttpMethod.POST))
            .andExpect(header("X-Internal-Token", "secret"))
            .andExpect(content().json("""
                {
                  "eventId": 9,
                  "roomId": 1,
                  "startTime": "2026-07-10T10:00:00",
                  "endTime": "2026-07-10T12:00:00",
                  "basePrice": 50000
                }
                """))
            .andRespond(withSuccess("{\"success\":true}", MediaType.APPLICATION_JSON));

        client.createForEvent(9L, 1L, startTime, endTime, BigDecimal.valueOf(50000));

        server.verify();
    }

    @Test
    void deleteByEvent_SendsInternalToken() {
        RestClient.Builder builder = RestClient.builder()
            .baseUrl("http://showtime-service")
            .defaultHeader("X-Internal-Token", "secret");
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        HttpEventShowtimeClient client = new HttpEventShowtimeClient(builder.build());

        server.expect(requestTo("http://showtime-service/internal/showtimes/events/9"))
            .andExpect(method(HttpMethod.DELETE))
            .andExpect(header("X-Internal-Token", "secret"))
            .andRespond(withSuccess("{\"success\":true}", MediaType.APPLICATION_JSON));

        client.deleteByEvent(9L);

        server.verify();
    }

    @Test
    void createForEvent_WhenShowtimeFails_FailsClosed() {
        RestClient.Builder builder = RestClient.builder().baseUrl("http://showtime-service");
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        HttpEventShowtimeClient client = new HttpEventShowtimeClient(builder.build());

        server.expect(requestTo("http://showtime-service/internal/showtimes/events"))
            .andRespond(withServerError());

        CustomException ex = assertThrows(CustomException.class, () -> client.createForEvent(
            9L,
            1L,
            LocalDateTime.of(2026, 7, 10, 10, 0),
            LocalDateTime.of(2026, 7, 10, 12, 0),
            BigDecimal.valueOf(50000)
        ));

        assertEquals("EVENT_SHOWTIME_SYNC_FAILED", ex.getErrorCode());
        server.verify();
    }
}
