package com.uit.cinema.catalog.config;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(
    controllers = CatalogSecurityRouteTest.SecurityProbeController.class,
    properties = {
        "cinema.security.jwt.enabled=true",
        "cinema.security.jwt.issuer-uri=https://auth.example/realms/cinema-booking",
        "cinema.security.jwt.audience=cinema-api",
        "cinema.security.jwt.jwk-set-uri=https://auth.example/realms/cinema-booking/protocol/openid-connect/certs"
    }
)
@ContextConfiguration(classes = {
    CatalogSecurityConfig.class,
    CatalogSecurityRouteTest.SecurityProbeController.class
})
class CatalogSecurityRouteTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void publicReadsRemainAnonymous() throws Exception {
        mockMvc.perform(get("/api/movies")).andExpect(status().isOk());
    }

    @Test
    void writesRequireAdmin() throws Exception {
        mockMvc.perform(post("/api/movies")).andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/movies").with(jwt().authorities(new SimpleGrantedAuthority("ROLE_CUSTOMER"))))
            .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/movies").with(jwt().authorities(new SimpleGrantedAuthority("ROLE_ADMIN"))))
            .andExpect(status().isOk());
    }

    @RestController
    @RequestMapping("/api/movies")
    static class SecurityProbeController {

        @GetMapping
        ResponseEntity<Void> read() {
            return ResponseEntity.ok().build();
        }

        @PostMapping
        ResponseEntity<Void> write() {
            return ResponseEntity.ok().build();
        }
    }
}
