package com.uit.cinema.chatbot.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class ChatbotSecurityConfig {

    private final boolean jwtEnabled;

    public ChatbotSecurityConfig(@Value("${cinema.security.jwt.enabled:false}") boolean jwtEnabled) {
        this.jwtEnabled = jwtEnabled;
    }

    @Bean
    @ConditionalOnProperty(prefix = "cinema.security.jwt", name = "enabled", havingValue = "true")
    public JwtDecoder chatbotJwtDecoder(
        @Value("${cinema.security.jwt.issuer-uri:}") String issuerUri,
        @Value("${cinema.security.jwt.audience:}") String audience,
        @Value("${cinema.security.jwt.jwk-set-uri:}") String jwkSetUri
    ) {
        return KeycloakJwtSupport.decoder(issuerUri, audience, jwkSetUri);
    }

    @Bean
    public SecurityFilterChain chatbotSecurityFilterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .cors(Customizer.withDefaults())
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS));

        if (!jwtEnabled) {
            return http.authorizeHttpRequests(auth -> auth
                .requestMatchers("/actuator/**", "/error", "/internal/**", "/api/chatbot/**").permitAll()
                .anyRequest().denyAll()
            ).build();
        }

        return http
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/actuator/**", "/error", "/internal/**").permitAll()
                .requestMatchers("/api/chatbot/**").authenticated()
                .anyRequest().denyAll()
            )
            .oauth2ResourceServer(oauth2 -> oauth2.jwt(jwt ->
                jwt.jwtAuthenticationConverter(KeycloakJwtSupport.authenticationConverter())
            ))
            .build();
    }
}
