package com.uit.cinema.booking.config;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(
    controllers = BookingSecurityRouteTest.SecurityProbeController.class,
    properties = {
        "cinema.security.jwt.enabled=true",
        "cinema.security.jwt.issuer-uri=https://auth.example/realms/cinema-booking",
        "cinema.security.jwt.audience=cinema-api",
        "cinema.security.jwt.jwk-set-uri=https://auth.example/realms/cinema-booking/protocol/openid-connect/certs"
    }
)
@ContextConfiguration(classes = {
    BookingSecurityConfig.class,
    BookingSecurityRouteTest.SecurityProbeController.class
})
class BookingSecurityRouteTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void reviewReadsAndVoucherValidationRemainPublic() throws Exception {
        mockMvc.perform(get("/api/reviews/movies/1")).andExpect(status().isOk());
        mockMvc.perform(get("/api/vouchers/validate/SAVE10")).andExpect(status().isOk());
    }

    @Test
    void bookingRoutesRequireAuthenticationAndVoucherWritesRequireAdmin() throws Exception {
        mockMvc.perform(get("/api/orders/1")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/orders/1").with(jwt().authorities(new SimpleGrantedAuthority("ROLE_CUSTOMER"))))
            .andExpect(status().isOk());
        mockMvc.perform(post("/api/vouchers").with(jwt().authorities(new SimpleGrantedAuthority("ROLE_CUSTOMER"))))
            .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/vouchers").with(jwt().authorities(new SimpleGrantedAuthority("ROLE_ADMIN"))))
            .andExpect(status().isOk());
    }

    @RestController
    static class SecurityProbeController {

        @GetMapping("/api/reviews/movies/{movieId}")
        ResponseEntity<Void> reviews(@PathVariable Long movieId) {
            return ResponseEntity.ok().build();
        }

        @GetMapping("/api/vouchers/validate/{code}")
        ResponseEntity<Void> validate(@PathVariable String code) {
            return ResponseEntity.ok().build();
        }

        @GetMapping("/api/orders/{orderId}")
        ResponseEntity<Void> order(@PathVariable Long orderId) {
            return ResponseEntity.ok().build();
        }

        @PostMapping("/api/vouchers")
        ResponseEntity<Void> voucher() {
            return ResponseEntity.ok().build();
        }
    }
}
