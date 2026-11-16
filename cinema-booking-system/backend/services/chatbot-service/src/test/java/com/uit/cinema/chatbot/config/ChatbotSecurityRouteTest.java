package com.uit.cinema.chatbot.config;

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
    controllers = ChatbotSecurityRouteTest.SecurityProbeController.class,
    properties = {
        "cinema.security.jwt.enabled=true",
        "cinema.security.jwt.issuer-uri=https://auth.example/realms/cinema-booking",
        "cinema.security.jwt.audience=cinema-api",
        "cinema.security.jwt.jwk-set-uri=https://auth.example/realms/cinema-booking/protocol/openid-connect/certs"
    }
)
@ContextConfiguration(classes = {
    ChatbotSecurityConfig.class,
    CorsConfig.class,
    ChatbotSecurityRouteTest.SecurityProbeController.class
})
class ChatbotSecurityRouteTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void chatRequiresATokenWhenJwtIsEnabled() throws Exception {
        mockMvc.perform(get("/api/chatbot/conversations")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/chatbot/conversations").with(jwt().authorities(new SimpleGrantedAuthority("ROLE_CUSTOMER"))))
            .andExpect(status().isOk());
    }

    @RestController
    static class SecurityProbeController {
        @GetMapping("/api/chatbot/conversations")
        ResponseEntity<Void> list() {
            return ResponseEntity.ok().build();
        }
    }
}
