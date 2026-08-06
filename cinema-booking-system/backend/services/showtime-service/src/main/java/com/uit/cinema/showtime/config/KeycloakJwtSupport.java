package com.uit.cinema.showtime.config;

import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtDecoders;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;
import org.springframework.util.Assert;
import org.springframework.util.StringUtils;

import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;

final class KeycloakJwtSupport {

    private static final Set<String> APPLICATION_ROLES = Set.of("ADMIN", "STAFF", "CUSTOMER");

    private KeycloakJwtSupport() {
    }

    static JwtDecoder decoder(String issuerUri, String audience, String jwkSetUri) {
        Assert.hasText(issuerUri, "KEYCLOAK_ISSUER_URI is required when JWT security is enabled");
        Assert.hasText(audience, "KEYCLOAK_AUDIENCE is required when JWT security is enabled");

        NimbusJwtDecoder decoder = StringUtils.hasText(jwkSetUri)
            ? NimbusJwtDecoder.withJwkSetUri(jwkSetUri).build()
            : JwtDecoders.fromIssuerLocation(issuerUri);
        decoder.setJwtValidator(tokenValidator(issuerUri, audience));
        return decoder;
    }

    static OAuth2TokenValidator<Jwt> tokenValidator(String issuerUri, String audience) {
        OAuth2TokenValidator<Jwt> audienceValidator = jwt -> jwt.getAudience().contains(audience)
            ? OAuth2TokenValidatorResult.success()
            : OAuth2TokenValidatorResult.failure(new OAuth2Error(
                "invalid_token",
                "The required audience is missing",
                null
            ));
        return new DelegatingOAuth2TokenValidator<>(
            JwtValidators.createDefaultWithIssuer(issuerUri),
            audienceValidator
        );
    }

    static Converter<Jwt, ? extends AbstractAuthenticationToken> authenticationConverter() {
        JwtGrantedAuthoritiesConverter scopeConverter = new JwtGrantedAuthoritiesConverter();
        return jwt -> {
            Set<GrantedAuthority> authorities = new LinkedHashSet<>(scopeConverter.convert(jwt));
            authorities.addAll(applicationRoleAuthorities(jwt));
            return new JwtAuthenticationToken(jwt, authorities, jwt.getSubject());
        };
    }

    private static Collection<GrantedAuthority> applicationRoleAuthorities(Jwt jwt) {
        Set<GrantedAuthority> authorities = new LinkedHashSet<>();
        Object realmAccess = jwt.getClaim("realm_access");
        if (!(realmAccess instanceof Map<?, ?> realmAccessMap)) {
            return authorities;
        }
        Object roles = realmAccessMap.get("roles");
        if (!(roles instanceof Collection<?> roleValues)) {
            return authorities;
        }
        roleValues.stream()
            .filter(String.class::isInstance)
            .map(String.class::cast)
            .filter(APPLICATION_ROLES::contains)
            .map(role -> new SimpleGrantedAuthority("ROLE_" + role))
            .forEach(authorities::add);
        return authorities;
    }
}
