package com.uit.cinema.rental.security;

import com.uit.cinema.core.exception.CustomException;
import com.uit.cinema.rental.client.RentalClients;
import com.uit.cinema.rental.service.RentalModels;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;

@Component
public class RentalActorResolver {

    private final boolean jwtEnabled;
    private final RentalClients.CinemaScopeClient scopes;

    public RentalActorResolver(
        @Value("${cinema.security.jwt.enabled:false}") boolean jwtEnabled,
        RentalClients.CinemaScopeClient scopes
    ) {
        this.jwtEnabled = jwtEnabled;
        this.scopes = scopes;
    }

    public Long userId(Long requestedUserId) {
        if (!jwtEnabled) {
            if (requestedUserId == null || requestedUserId <= 0) {
                throw new CustomException("User is required", HttpStatus.BAD_REQUEST, "USER_REQUIRED");
            }
            return requestedUserId;
        }
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (!(authentication instanceof JwtAuthenticationToken jwt) || !authentication.isAuthenticated()) {
            throw new CustomException("Authentication is required", HttpStatus.UNAUTHORIZED, "AUTHENTICATION_REQUIRED");
        }
        Object claim = jwt.getToken().getClaim("user_id");
        try {
            long userId = new BigDecimal(String.valueOf(claim)).longValueExact();
            if (userId <= 0) {
                throw new ArithmeticException("user_id");
            }
            if (requestedUserId != null && requestedUserId != userId) {
                throw new CustomException("Requested user does not match the authenticated user", HttpStatus.FORBIDDEN, "USER_ID_MISMATCH");
            }
            return userId;
        } catch (ArithmeticException | NumberFormatException ex) {
            throw new CustomException("Authenticated user profile mapping is not available", HttpStatus.SERVICE_UNAVAILABLE, "USER_ID_MAPPING_UNAVAILABLE");
        }
    }

    public RentalModels.Actor actor(Long requestedUserId) {
        Long userId = userId(requestedUserId);
        RentalClients.CinemaScope scope = scopes.scopeOf(userId);
        return new RentalModels.Actor(userId, scope.realmRole(), scope.cinemaIds());
    }
}
