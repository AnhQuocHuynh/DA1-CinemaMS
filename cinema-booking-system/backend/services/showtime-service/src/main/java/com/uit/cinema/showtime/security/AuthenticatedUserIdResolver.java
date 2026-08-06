package com.uit.cinema.showtime.security;

import com.uit.cinema.core.exception.CustomException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;

@Component
public class AuthenticatedUserIdResolver {

    private final boolean jwtEnabled;

    public AuthenticatedUserIdResolver(@Value("${cinema.security.jwt.enabled:false}") boolean jwtEnabled) {
        this.jwtEnabled = jwtEnabled;
    }

    public Long resolveSelf(Long requestedUserId) {
        if (!jwtEnabled) {
            return requireLegacyUserId(requestedUserId);
        }

        Long authenticatedUserId = currentUserId();
        if (requestedUserId != null && !authenticatedUserId.equals(requestedUserId)) {
            throw new CustomException(
                "Requested user does not match the authenticated user",
                HttpStatus.FORBIDDEN,
                "USER_ID_MISMATCH"
            );
        }
        return authenticatedUserId;
    }

    public boolean isJwtEnabled() {
        return jwtEnabled;
    }

    private Long currentUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (!(authentication instanceof JwtAuthenticationToken jwtAuthentication) || !authentication.isAuthenticated()) {
            throw new CustomException(
                "Authentication is required",
                HttpStatus.UNAUTHORIZED,
                "AUTHENTICATION_REQUIRED"
            );
        }

        Object userIdClaim = jwtAuthentication.getToken().getClaim("user_id");
        try {
            long userId = new BigDecimal(String.valueOf(userIdClaim)).longValueExact();
            if (userId <= 0) {
                throw new ArithmeticException("user_id must be positive");
            }
            return userId;
        } catch (ArithmeticException | NumberFormatException exception) {
            throw new CustomException(
                "Authenticated user profile mapping is not available",
                HttpStatus.SERVICE_UNAVAILABLE,
                "USER_ID_MAPPING_UNAVAILABLE"
            );
        }
    }

    private Long requireLegacyUserId(Long userId) {
        if (userId == null || userId <= 0) {
            throw new CustomException("User ID is required", HttpStatus.BAD_REQUEST, "USER_ID_REQUIRED");
        }
        return userId;
    }
}
