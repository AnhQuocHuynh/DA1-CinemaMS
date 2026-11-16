package com.uit.cinema.chatbot.security;

import com.uit.cinema.chatbot.config.ChatbotProperties;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;

@Component
public class ActorResolver {

    private final boolean jwtEnabled;
    private final long devActorId;

    public ActorResolver(
        @Value("${cinema.security.jwt.enabled:false}") boolean jwtEnabled,
        ChatbotProperties properties
    ) {
        this.jwtEnabled = jwtEnabled;
        this.devActorId = properties.getDevActorId();
    }

    public long currentActor() {
        if (!jwtEnabled) {
            return devActorId;
        }
        return userIdFromToken();
    }

    public boolean bookingLookupAllowed() {
        return jwtEnabled;
    }

    private long userIdFromToken() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (!(authentication instanceof JwtAuthenticationToken jwtAuthentication) || !authentication.isAuthenticated()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "AUTHENTICATION_REQUIRED");
        }
        Object claim = jwtAuthentication.getToken().getClaim("user_id");
        if (claim == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "AUTHENTICATION_REQUIRED");
        }
        try {
            long userId = new BigDecimal(String.valueOf(claim)).longValueExact();
            if (userId <= 0) {
                throw new ArithmeticException("user_id must be positive");
            }
            return userId;
        } catch (ArithmeticException | NumberFormatException exception) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "AUTHENTICATION_REQUIRED");
        }
    }
}
