package com.uit.cinema.analytics.config;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(
    controllers = AnalyticsSecurityRouteTest.SecurityProbeController.class,
    properties = {
        "cinema.security.jwt.enabled=true",
        "cinema.security.jwt.issuer-uri=https://auth.example/realms/cinema-booking",
        "cinema.security.jwt.audience=cinema-api",
        "cinema.security.jwt.jwk-set-uri=https://auth.example/realms/cinema-booking/protocol/openid-connect/certs"
    }
)
@ContextConfiguration(classes = {
    AnalyticsSecurityConfig.class,
    AnalyticsSecurityRouteTest.SecurityProbeController.class
})
class AnalyticsSecurityRouteTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void dashboardRequiresAdmin() throws Exception {
        mockMvc.perform(get("/api/admin/dashboard/overview")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/admin/dashboard/overview").with(jwt().authorities(new SimpleGrantedAuthority("ROLE_CUSTOMER"))))
            .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/admin/dashboard/overview").with(jwt().authorities(new SimpleGrantedAuthority("ROLE_ADMIN"))))
            .andExpect(status().isOk());
    }

    @RestController
    static class SecurityProbeController {

        @GetMapping("/api/admin/dashboard/overview")
        ResponseEntity<Void> dashboard() {
            return ResponseEntity.ok().build();
        }
    }
}
