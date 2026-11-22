package com.uit.cinema.rental.config;

import com.uit.cinema.rental.service.RentalRules;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.ZoneId;

@Configuration
public class RentalConfig {

    @Bean
    Clock rentalClock(@Value("${app.rental.zone:Asia/Ho_Chi_Minh}") String zone) {
        return Clock.system(ZoneId.of(zone));
    }

    @Bean
    RentalRules rentalRules(
        @Value("${app.rental.turnover-minutes:15}") int turnoverMinutes,
        @Value("${app.rental.customer-cancel-hours:24}") int customerCancelHours,
        @Value("${app.rental.default-price-per-hour:150000}") BigDecimal defaultPricePerHour,
        @Value("${app.rental.weekend-multiplier:1.5}") BigDecimal weekendMultiplier,
        @Value("${app.rental.peak-multiplier:1.2}") BigDecimal peakMultiplier,
        @Value("${app.rental.peak-start-hour:18}") int peakStartHour,
        @Value("${app.rental.peak-end-hour:22}") int peakEndHour
    ) {
        return new RentalRules(
            turnoverMinutes,
            customerCancelHours,
            defaultPricePerHour,
            weekendMultiplier,
            peakMultiplier,
            peakStartHour,
            peakEndHour
        );
    }
}
