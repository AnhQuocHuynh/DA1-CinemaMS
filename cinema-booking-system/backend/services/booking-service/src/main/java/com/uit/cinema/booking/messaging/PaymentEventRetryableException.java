package com.uit.cinema.booking.messaging;

/**
 * Transient payment-event failure. The listener retries, then dead-letters.
 */
public class PaymentEventRetryableException extends RuntimeException {

    public PaymentEventRetryableException(String message) {
        super(message);
    }

    public PaymentEventRetryableException(String message, Throwable cause) {
        super(message, cause);
    }
}
