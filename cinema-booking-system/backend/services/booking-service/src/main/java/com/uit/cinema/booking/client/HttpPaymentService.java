package com.uit.cinema.booking.client;

import com.uit.cinema.core.exception.CustomException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.math.BigDecimal;
import java.util.Map;

@Slf4j
@Component
public class HttpPaymentService {

    private final RestClient restClient;

    public HttpPaymentService(
        RestClient.Builder builder,
        @Value("${services.payment.url:http://localhost:5003}") String paymentBaseUrl,
        @Value("${app.internal-token}") String internalToken
    ) {
        this.restClient = builder
            .baseUrl(paymentBaseUrl)
            .defaultHeader("X-Internal-Token", internalToken)
            .build();
    }

    public void executeOrderRefund(Long orderId, BigDecimal amount, String reason) {
        try {
            restClient.post()
                .uri("/api/payments/order/{orderId}/refund", orderId)
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of(
                    "amount", amount,
                    "reason", reason != null ? reason : "Customer refund request"
                ))
                .retrieve()
                .toBodilessEntity();
            log.info("Successfully executed payment refund for order {} (amount: {})", orderId, amount);
        } catch (RestClientResponseException ex) {
            log.error("Payment refund failed for order {}: {} - {}", orderId, ex.getStatusCode(), ex.getResponseBodyAsString());
            throw new CustomException(
                "Payment gateway refund failed: " + ex.getResponseBodyAsString(),
                HttpStatus.valueOf(ex.getStatusCode().value()),
                "PAYMENT_REFUND_FAILED"
            );
        } catch (Exception ex) {
            log.error("Unexpected error contacting payment service for order {}: {}", orderId, ex.getMessage());
            throw new CustomException(
                "Unable to contact payment service: " + ex.getMessage(),
                HttpStatus.BAD_GATEWAY,
                "PAYMENT_SERVICE_UNAVAILABLE"
            );
        }
    }
}
