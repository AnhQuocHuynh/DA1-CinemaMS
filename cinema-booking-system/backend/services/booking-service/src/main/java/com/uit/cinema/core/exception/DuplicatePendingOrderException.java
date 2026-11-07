package com.uit.cinema.core.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;

@Getter
public class DuplicatePendingOrderException extends CustomException {
    private final Long existingOrderId;

    public DuplicatePendingOrderException(Long existingOrderId) {
        super("A pending order already exists for this showtime", HttpStatus.CONFLICT, "DUPLICATE_PENDING_ORDER");
        this.existingOrderId = existingOrderId;
    }
}
