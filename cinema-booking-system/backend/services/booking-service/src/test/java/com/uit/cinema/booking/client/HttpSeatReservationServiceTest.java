package com.uit.cinema.booking.client;

import com.uit.cinema.core.exception.CustomException;
import com.uit.cinema.showtime.service.contract.SeatBookingRequest;
import com.uit.cinema.showtime.service.contract.SeatHoldValidationResult;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class HttpSeatReservationServiceTest {

    @Test
    void validateHeldSeats_SendsInternalTokenAndReturnsData() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        HttpSeatReservationService client = new HttpSeatReservationService(
            builder,
            "http://showtime-service",
            "secret"
        );

        server.expect(requestTo("http://showtime-service/internal/showtimes/seats/validate-held"))
            .andExpect(method(HttpMethod.POST))
            .andExpect(header("X-Internal-Token", "secret"))
            .andExpect(content().json("""
                {
                  "userId": 1,
                  "showtimeId": 2,
                  "seatIds": [10]
                }
                """))
            .andRespond(withSuccess("""
                {
                  "success": true,
                  "data": {
                    "seats": [
                      { "seatId": 10, "price": 50000 }
                    ],
                    "totalAmount": 50000
                  }
                }
                """, MediaType.APPLICATION_JSON));

        SeatHoldValidationResult result = client.validateHeldSeats(new SeatBookingRequest(1L, 2L, List.of(10L)));

        assertEquals(BigDecimal.valueOf(50000), result.totalAmount());
        assertEquals(10L, result.seats().getFirst().seatId());
        server.verify();
    }

    @Test
    void confirmHeldSeats_WhenShowtimeFails_FailsClosed() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        HttpSeatReservationService client = new HttpSeatReservationService(
            builder,
            "http://showtime-service",
            "secret"
        );

        server.expect(requestTo("http://showtime-service/internal/showtimes/seats/confirm-held"))
            .andRespond(withServerError());

        CustomException ex = assertThrows(
            CustomException.class,
            () -> client.confirmHeldSeats(new SeatBookingRequest(1L, 2L, List.of(10L)))
        );

        assertEquals("SHOWTIME_RESERVATION_UNAVAILABLE", ex.getErrorCode());
        server.verify();
    }
}
