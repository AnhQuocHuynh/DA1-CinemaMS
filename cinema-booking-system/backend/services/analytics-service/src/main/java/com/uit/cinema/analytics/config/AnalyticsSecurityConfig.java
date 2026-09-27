package com.uit.cinema.analytics.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
@EnableWebSecurity
public class AnalyticsSecurityConfig {

    private final boolean jwtEnabled;

    public AnalyticsSecurityConfig(@Value("${cinema.security.jwt.enabled:false}") boolean jwtEnabled) {
        this.jwtEnabled = jwtEnabled;
    }

    @Bean
    @ConditionalOnProperty(prefix = "cinema.security.jwt", name = "enabled", havingValue = "true")
    public JwtDecoder analyticsJwtDecoder(
        @Value("${cinema.security.jwt.issuer-uri:}") String issuerUri,
        @Value("${cinema.security.jwt.audience:}") String audience,
        @Value("${cinema.security.jwt.jwk-set-uri:}") String jwkSetUri
    ) {
        return KeycloakJwtSupport.decoder(issuerUri, audience, jwkSetUri);
    }

    @Bean
    public SecurityFilterChain analyticsSecurityFilterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS));

        if (!jwtEnabled) {
            return http.authorizeHttpRequests(auth -> auth
                .requestMatchers("/actuator/health", "/api/admin/dashboard/**").permitAll()
                .anyRequest().denyAll()
            )
            .build();
        }

        return http
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/actuator/health").permitAll()
                .requestMatchers("/api/admin/dashboard/**").hasRole("ADMIN")
                .anyRequest().denyAll()
            )
            .oauth2ResourceServer(oauth2 -> oauth2.jwt(jwt ->
                jwt.jwtAuthenticationConverter(KeycloakJwtSupport.authenticationConverter())
            ))
            .build();
    }
}
