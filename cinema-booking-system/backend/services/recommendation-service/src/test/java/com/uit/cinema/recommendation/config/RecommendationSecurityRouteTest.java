package com.uit.cinema.recommendation.config;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(
    controllers = RecommendationSecurityRouteTest.SecurityProbeController.class,
    properties = {
        "cinema.security.jwt.enabled=true",
        "cinema.security.jwt.issuer-uri=https://auth.example/realms/cinema-booking",
        "cinema.security.jwt.audience=cinema-api",
        "cinema.security.jwt.jwk-set-uri=https://auth.example/realms/cinema-booking/protocol/openid-connect/certs"
    }
)
@ContextConfiguration(classes = {
    RecommendationSecurityConfig.class,
    RecommendationSecurityRouteTest.SecurityProbeController.class
})
class RecommendationSecurityRouteTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void publicAndPersonalizedRoutesHaveDistinctPolicies() throws Exception {
        mockMvc.perform(get("/api/recommendations/movies/popular")).andExpect(status().isOk());
        mockMvc.perform(get("/api/recommendations/movies/1/similar")).andExpect(status().isOk());
        mockMvc.perform(get("/api/recommendations/movies")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/recommendations/movies").with(jwt().authorities(new SimpleGrantedAuthority("ROLE_CUSTOMER"))))
            .andExpect(status().isOk());
        mockMvc.perform(get("/api/recommendations/users/1/taste-profile")).andExpect(status().isUnauthorized());
    }

    @RestController
    static class SecurityProbeController {

        @GetMapping("/api/recommendations/movies/popular")
        ResponseEntity<Void> popular() {
            return ResponseEntity.ok().build();
        }

        @GetMapping("/api/recommendations/movies/{movieId}/similar")
        ResponseEntity<Void> similar(@PathVariable Long movieId) {
            return ResponseEntity.ok().build();
        }

        @GetMapping("/api/recommendations/movies")
        ResponseEntity<Void> personalized() {
            return ResponseEntity.ok().build();
        }

        @GetMapping("/api/recommendations/users/{userId}/taste-profile")
        ResponseEntity<Void> tasteProfile(@PathVariable Long userId) {
            return ResponseEntity.ok().build();
        }
    }
}
