package com.uit.cinema.recommendation.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;

@Component
public class AuthenticatedUserIdResolver {

    private final boolean jwtEnabled;

    public AuthenticatedUserIdResolver(@Value("${cinema.security.jwt.enabled:false}") boolean jwtEnabled) {
        this.jwtEnabled = jwtEnabled;
    }

    public Long resolvePersonalizedUser(Long requestedUserId) {
        if (!jwtEnabled) {
            return requestedUserId;
        }
        return resolveSelf(requestedUserId);
    }

    public Long authorizeTasteProfileUser(Long requestedUserId) {
        if (!jwtEnabled || hasRole("ADMIN")) {
            return requestedUserId;
        }
        return resolveSelf(requestedUserId);
    }

    private Long resolveSelf(Long requestedUserId) {
        Long authenticatedUserId = currentUserId();
        if (requestedUserId != null && !authenticatedUserId.equals(requestedUserId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "USER_ID_MISMATCH");
        }
        return authenticatedUserId;
    }

    private Long currentUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (!(authentication instanceof JwtAuthenticationToken jwtAuthentication) || !authentication.isAuthenticated()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "AUTHENTICATION_REQUIRED");
        }

        Object userIdClaim = jwtAuthentication.getToken().getClaim("user_id");
        try {
            long userId = new BigDecimal(String.valueOf(userIdClaim)).longValueExact();
            if (userId <= 0) {
                throw new ArithmeticException("user_id must be positive");
            }
            return userId;
        } catch (ArithmeticException | NumberFormatException exception) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "USER_ID_MAPPING_UNAVAILABLE");
        }
    }

    private boolean hasRole(String role) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return authentication != null
            && authentication.isAuthenticated()
            && authentication.getAuthorities().stream()
                .anyMatch(authority -> authority.getAuthority().equals("ROLE_" + role));
    }
}
