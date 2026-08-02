package com.uit.cinema.core.outbox;

import org.springframework.amqp.core.TopicExchange;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConditionalOnProperty(name = "outbox.dispatcher.enabled", havingValue = "true")
public class OutboxAmqpConfiguration {

    @Bean
    TopicExchange catalogEventsExchange() {
        return new TopicExchange("catalog.events", true, false);
    }
}

