package com.uit.cinema.facility;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication(scanBasePackages = "com.uit.cinema")
public class FacilityServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(FacilityServiceApplication.class, args);
    }
}
