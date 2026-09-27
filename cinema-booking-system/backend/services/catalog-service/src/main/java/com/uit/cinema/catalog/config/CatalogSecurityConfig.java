package com.uit.cinema.catalog.config;

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
public class CatalogSecurityConfig {

    private final boolean jwtEnabled;

    public CatalogSecurityConfig(@Value("${cinema.security.jwt.enabled:false}") boolean jwtEnabled) {
        this.jwtEnabled = jwtEnabled;
    }

    @Bean
    @ConditionalOnProperty(prefix = "cinema.security.jwt", name = "enabled", havingValue = "true")
    public JwtDecoder catalogJwtDecoder(
        @Value("${cinema.security.jwt.issuer-uri:}") String issuerUri,
        @Value("${cinema.security.jwt.audience:}") String audience,
        @Value("${cinema.security.jwt.jwk-set-uri:}") String jwkSetUri
    ) {
        return KeycloakJwtSupport.decoder(issuerUri, audience, jwkSetUri);
    }

    @Bean
    public SecurityFilterChain catalogSecurityFilterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS));

        if (!jwtEnabled) {
            return http.authorizeHttpRequests(auth -> auth
                .requestMatchers("/actuator/health", "/internal/catalog/**", "/api/catalog/**", "/api/movies/**", "/api/events/**", "/api/genres/**").permitAll()
                .anyRequest().denyAll()
            )
            .build();
        }

        return http
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/actuator/health", "/internal/catalog/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/events/all").hasRole("ADMIN")
                .requestMatchers(HttpMethod.GET, "/api/catalog/**", "/api/movies/**", "/api/events/**", "/api/genres/**").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/movies/**", "/api/events/**", "/api/genres/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.PUT, "/api/movies/**", "/api/events/**", "/api/genres/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.DELETE, "/api/movies/**", "/api/events/**", "/api/genres/**").hasRole("ADMIN")
                .anyRequest().denyAll()
            )
            .oauth2ResourceServer(oauth2 -> oauth2.jwt(jwt ->
                jwt.jwtAuthenticationConverter(KeycloakJwtSupport.authenticationConverter())
            ))
            .build();
    }
}
