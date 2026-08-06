package com.uit.cinema.showtime.config;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(
    controllers = ShowtimeSecurityRouteTest.SecurityProbeController.class,
    properties = {
        "cinema.security.jwt.enabled=true",
        "cinema.security.jwt.issuer-uri=https://auth.example/realms/cinema-booking",
        "cinema.security.jwt.audience=cinema-api",
        "cinema.security.jwt.jwk-set-uri=https://auth.example/realms/cinema-booking/protocol/openid-connect/certs"
    }
)
@ContextConfiguration(classes = {
    ShowtimeSecurityConfig.class,
    ShowtimeSecurityRouteTest.SecurityProbeController.class
})
class ShowtimeSecurityRouteTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void readsRemainPublicAndSeatHoldsRequireAuthentication() throws Exception {
        mockMvc.perform(get("/api/showtimes/1")).andExpect(status().isOk());
        mockMvc.perform(post("/api/showtimes/1/hold")).andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/showtimes/1/hold").with(jwt().authorities(new SimpleGrantedAuthority("ROLE_CUSTOMER"))))
            .andExpect(status().isOk());
    }

    @Test
    void managementRoutesEnforceStaffAndAdminRoles() throws Exception {
        mockMvc.perform(post("/api/showtimes").with(jwt().authorities(new SimpleGrantedAuthority("ROLE_CUSTOMER"))))
            .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/showtimes").with(jwt().authorities(new SimpleGrantedAuthority("ROLE_STAFF"))))
            .andExpect(status().isOk());
        mockMvc.perform(delete("/api/showtimes/1").with(jwt().authorities(new SimpleGrantedAuthority("ROLE_STAFF"))))
            .andExpect(status().isForbidden());
        mockMvc.perform(delete("/api/showtimes/1").with(jwt().authorities(new SimpleGrantedAuthority("ROLE_ADMIN"))))
            .andExpect(status().isOk());
    }

    @RestController
    @RequestMapping("/api/showtimes")
    static class SecurityProbeController {

        @GetMapping("/{id}")
        ResponseEntity<Void> read(@PathVariable Long id) {
            return ResponseEntity.ok().build();
        }

        @PostMapping("/{id}/hold")
        ResponseEntity<Void> hold(@PathVariable Long id) {
            return ResponseEntity.ok().build();
        }

        @PostMapping
        ResponseEntity<Void> create() {
            return ResponseEntity.ok().build();
        }

        @DeleteMapping("/{id}")
        ResponseEntity<Void> delete(@PathVariable Long id) {
            return ResponseEntity.ok().build();
        }
    }
}
