package com.uit.cinema.rental.client;

import com.uit.cinema.rental.service.RentalNotifier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.LinkedHashMap;
import java.util.Map;

@Component
public class HttpRentalNotifier implements RentalNotifier {

    private static final Logger log = LoggerFactory.getLogger(HttpRentalNotifier.class);

    private final RestClient notifications;

    public HttpRentalNotifier(
        RestClient.Builder builder,
        @Value("${services.notification.url}") String notificationUrl
    ) {
        this.notifications = builder.clone().baseUrl(notificationUrl).build();
    }

    @Override
    public void statusChanged(Long userId, Long rentalId, String title, String body) {
        try {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("userId", userId);
            payload.put("type", "RENTAL_STATUS");
            payload.put("channel", "PUSH");
            payload.put("title", title);
            payload.put("body", body);
            payload.put("metadata", Map.of("rentalId", rentalId == null ? 0 : rentalId));
            notifications.post()
                .uri("/api/notifications")
                .body(payload)
                .retrieve()
                .toBodilessEntity();
        } catch (RuntimeException ex) {
            log.warn("Rental notification was not stored for rental {}: {}", rentalId, ex.toString());
        }
    }
}
