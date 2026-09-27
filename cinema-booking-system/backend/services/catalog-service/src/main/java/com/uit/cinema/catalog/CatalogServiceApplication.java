package com.uit.cinema.catalog;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication(scanBasePackages = "com.uit.cinema")
@EntityScan(basePackages = {"com.uit.cinema.catalog.entity", "com.uit.cinema.core.outbox"})
@EnableJpaRepositories(basePackages = {"com.uit.cinema.catalog.repository", "com.uit.cinema.core.outbox"})
@EnableScheduling
public class CatalogServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(CatalogServiceApplication.class, args);
    }
}
