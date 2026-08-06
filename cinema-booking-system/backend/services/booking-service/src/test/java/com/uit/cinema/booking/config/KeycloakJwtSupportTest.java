package com.uit.cinema.booking.config;

import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class KeycloakJwtSupportTest {

    private static final String ISSUER = "https://auth.example/realms/cinema-booking";
    private static final String AUDIENCE = "cinema-api";

    @Test
    void authenticationConverterMapsOnlyCanonicalApplicationRolesAndScopes() {
        Jwt jwt = validJwt()
            .claim("scope", "booking.read")
            .claim("realm_access", Map.of(
                "roles", List.of("ADMIN", "STAFF", "CUSTOMER", "USER", "offline_access")
            ))
            .build();

        AbstractAuthenticationToken authentication = KeycloakJwtSupport.authenticationConverter().convert(jwt);

        assertThat(authentication).isNotNull();
        assertThat(authentication.getAuthorities())
            .extracting("authority")
            .containsExactlyInAnyOrder("SCOPE_booking.read", "ROLE_ADMIN", "ROLE_STAFF", "ROLE_CUSTOMER");
    }

    @Test
    void tokenValidatorRequiresIssuerAudienceAndValidTimeWindow() {
        var validator = KeycloakJwtSupport.tokenValidator(ISSUER, AUDIENCE);
        Instant now = Instant.now();

        assertThat(validator.validate(validJwt().build()).hasErrors()).isFalse();
        assertThat(validator.validate(validJwt().audience(List.of("another-api")).build()).hasErrors()).isTrue();
        assertThat(validator.validate(validJwt().issuer("https://wrong.example/realms/cinema-booking").build()).hasErrors()).isTrue();
        assertThat(validator.validate(baseJwt(now.minusSeconds(300), now.minusSeconds(120)).build()).hasErrors()).isTrue();
        assertThat(validator.validate(validJwt().notBefore(now.plusSeconds(120)).build()).hasErrors()).isTrue();
    }

    private Jwt.Builder validJwt() {
        Instant now = Instant.now();
        return baseJwt(now.minusSeconds(30), now.plusSeconds(300));
    }

    private Jwt.Builder baseJwt(Instant issuedAt, Instant expiresAt) {
        return Jwt.withTokenValue("test-token")
            .header("alg", "RS256")
            .subject("8ddf9d5a-3282-4908-bcef-603b44f347ba")
            .issuer(ISSUER)
            .audience(List.of(AUDIENCE))
            .issuedAt(issuedAt)
            .expiresAt(expiresAt);
    }
}
