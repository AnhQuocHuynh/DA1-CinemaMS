package com.uit.cinema.showtime.security;

import com.uit.cinema.core.exception.CustomException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

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
    void jwtModeUsesSignedClaimAndRejectsMismatchedHeader() {
        authenticate(42L);
        AuthenticatedUserIdResolver resolver = new AuthenticatedUserIdResolver(true);

        assertThat(resolver.resolveSelf(null)).isEqualTo(42L);
        assertThat(resolver.resolveSelf(42L)).isEqualTo(42L);
        assertThatThrownBy(() -> resolver.resolveSelf(99L))
            .isInstanceOfSatisfying(CustomException.class, exception -> {
                assertThat(exception.getStatus().value()).isEqualTo(403);
                assertThat(exception.getErrorCode()).isEqualTo("USER_ID_MISMATCH");
            });
    }

    @Test
    void missingApplicationMappingFailsClosedAndCompatibilityModeKeepsHeaderContract() {
        authenticate(null);
        AuthenticatedUserIdResolver resolver = new AuthenticatedUserIdResolver(true);

        assertThatThrownBy(() -> resolver.resolveSelf(null))
            .isInstanceOfSatisfying(CustomException.class, exception -> {
                assertThat(exception.getStatus().value()).isEqualTo(503);
                assertThat(exception.getErrorCode()).isEqualTo("USER_ID_MAPPING_UNAVAILABLE");
            });
        assertThat(new AuthenticatedUserIdResolver(false).resolveSelf(7L)).isEqualTo(7L);
    }

    private void authenticate(Long userId) {
        Jwt.Builder jwt = Jwt.withTokenValue("test-token")
            .header("alg", "RS256")
            .subject("keycloak-subject")
            .issuedAt(Instant.now().minusSeconds(30))
            .expiresAt(Instant.now().plusSeconds(300));
        if (userId != null) {
            jwt.claim("user_id", userId);
        }
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt.build(), List.of()));
    }
}
