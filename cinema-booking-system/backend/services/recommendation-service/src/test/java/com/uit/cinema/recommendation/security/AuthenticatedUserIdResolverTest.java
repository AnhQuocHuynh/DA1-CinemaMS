package com.uit.cinema.recommendation.security;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AuthenticatedUserIdResolverTest {

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void personalizedRecommendationsUseAuthenticatedUser() {
        authenticate(42L, "CUSTOMER");
        AuthenticatedUserIdResolver resolver = new AuthenticatedUserIdResolver(true);

        assertThat(resolver.resolvePersonalizedUser(null)).isEqualTo(42L);
        assertThatThrownBy(() -> resolver.resolvePersonalizedUser(99L))
            .isInstanceOfSatisfying(ResponseStatusException.class, exception ->
                assertThat(exception.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN));
    }

    @Test
    void adminCanReadExplicitTasteProfileAndMissingMappingFailsClosed() {
        authenticate(null, "ADMIN");
        assertThat(new AuthenticatedUserIdResolver(true).authorizeTasteProfileUser(99L)).isEqualTo(99L);

        authenticate(null, "CUSTOMER");
        assertThatThrownBy(() -> new AuthenticatedUserIdResolver(true).resolvePersonalizedUser(null))
            .isInstanceOfSatisfying(ResponseStatusException.class, exception ->
                assertThat(exception.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE));
    }

    @Test
    void compatibilityModePreservesOptionalLegacyUserId() {
        AuthenticatedUserIdResolver resolver = new AuthenticatedUserIdResolver(false);
        assertThat(resolver.resolvePersonalizedUser(null)).isNull();
        assertThat(resolver.resolvePersonalizedUser(7L)).isEqualTo(7L);
    }

    private void authenticate(Long userId, String role) {
        Jwt.Builder jwt = Jwt.withTokenValue("test-token")
            .header("alg", "RS256")
            .subject("keycloak-subject")
            .issuedAt(Instant.now().minusSeconds(30))
            .expiresAt(Instant.now().plusSeconds(300));
        if (userId != null) {
            jwt.claim("user_id", userId);
        }
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(
            jwt.build(),
            List.of(new SimpleGrantedAuthority("ROLE_" + role))
        ));
    }
}
