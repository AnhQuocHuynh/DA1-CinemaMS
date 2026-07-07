package com.uit.cinema.facility.service.client;

import com.uit.cinema.core.exception.CustomException;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.web.client.RestClient;
import org.springframework.test.web.client.MockRestServiceServer;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class HttpFacilityShowtimeGuardTest {

    @Test
    void hasFutureShowtimesForRoom_SendsInternalTokenAndReturnsData() {
        RestClient.Builder builder = RestClient.builder()
            .baseUrl("http://showtime-service")
            .defaultHeader("X-Internal-Token", "secret");
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        HttpFacilityShowtimeGuard guard = new HttpFacilityShowtimeGuard(builder.build());

        server.expect(requestTo("http://showtime-service/internal/showtimes/rooms/1/future-exists"))
            .andExpect(method(HttpMethod.GET))
            .andExpect(header("X-Internal-Token", "secret"))
            .andRespond(withSuccess("{\"success\":true,\"data\":true}", MediaType.APPLICATION_JSON));

        assertTrue(guard.hasFutureShowtimesForRoom(1L));
        server.verify();
    }

    @Test
    void hasFutureShowtimesForRooms_SendsBodyAndReturnsData() {
        RestClient.Builder builder = RestClient.builder()
            .baseUrl("http://showtime-service")
            .defaultHeader("X-Internal-Token", "secret");
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        HttpFacilityShowtimeGuard guard = new HttpFacilityShowtimeGuard(builder.build());

        server.expect(requestTo("http://showtime-service/internal/showtimes/rooms/future-exists"))
            .andExpect(method(HttpMethod.POST))
            .andExpect(header("X-Internal-Token", "secret"))
            .andExpect(content().json("{\"roomIds\":[1,2]}"))
            .andRespond(withSuccess("{\"success\":true,\"data\":false}", MediaType.APPLICATION_JSON));

        assertFalse(guard.hasFutureShowtimesForRooms(List.of(1L, 2L)));
        server.verify();
    }

    @Test
    void hasFutureShowtimesForRoom_WhenShowtimeUnavailable_FailsClosed() {
        RestClient.Builder builder = RestClient.builder().baseUrl("http://showtime-service");
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        HttpFacilityShowtimeGuard guard = new HttpFacilityShowtimeGuard(builder.build());

        server.expect(requestTo("http://showtime-service/internal/showtimes/rooms/1/future-exists"))
            .andRespond(withServerError());

        CustomException ex = assertThrows(CustomException.class, () -> guard.hasFutureShowtimesForRoom(1L));

        assertEquals("SHOWTIME_GUARD_UNAVAILABLE", ex.getErrorCode());
        server.verify();
    }
}
