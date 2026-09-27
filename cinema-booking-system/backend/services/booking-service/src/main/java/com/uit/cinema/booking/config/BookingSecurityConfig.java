package com.uit.cinema.booking.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class BookingSecurityConfig {

    private final boolean jwtEnabled;

    public BookingSecurityConfig(@Value("${cinema.security.jwt.enabled:false}") boolean jwtEnabled) {
        this.jwtEnabled = jwtEnabled;
    }

    @Bean
    @ConditionalOnProperty(prefix = "cinema.security.jwt", name = "enabled", havingValue = "true")
    public JwtDecoder bookingJwtDecoder(
        @Value("${cinema.security.jwt.issuer-uri:}") String issuerUri,
        @Value("${cinema.security.jwt.audience:}") String audience,
        @Value("${cinema.security.jwt.jwk-set-uri:}") String jwkSetUri
    ) {
        return KeycloakJwtSupport.decoder(issuerUri, audience, jwkSetUri);
    }

    @Bean
    public SecurityFilterChain bookingSecurityFilterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS));

        if (!jwtEnabled) {
            return http.authorizeHttpRequests(auth -> auth
                .requestMatchers(
                    "/actuator/health",
                    "/api/orders/**",
                    "/api/tickets/**",
                    "/api/vouchers/**",
                    "/api/reviews/**"
                ).permitAll()
                .anyRequest().denyAll()
            )
            .build();
        }

        return http
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/actuator/health").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/vouchers/validate/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/reviews/movies/*/eligibility", "/api/reviews/events/*/eligibility").authenticated()
                .requestMatchers(HttpMethod.GET, "/api/reviews/**").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/reviews").authenticated()
                .requestMatchers(HttpMethod.POST, "/api/tickets/check-in").hasAnyRole("STAFF", "ADMIN")
                .requestMatchers("/api/orders/**", "/api/tickets/**").authenticated()
                .requestMatchers("/api/vouchers/**").hasRole("ADMIN")
                .anyRequest().denyAll()
            )
            .oauth2ResourceServer(oauth2 -> oauth2.jwt(jwt ->
                jwt.jwtAuthenticationConverter(KeycloakJwtSupport.authenticationConverter())
            ))
            .build();
    }
}
