package com.uit.cinema.analytics.messaging;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.DirectExchange;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.QueueBuilder;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConditionalOnProperty(name = "analytics.messaging.enabled", havingValue = "true")
public class AnalyticsAmqpConfiguration {

    static final String DEAD_LETTER_EXCHANGE = "cinema.events.dlx";

    @Bean
    TopicExchange analyticsCatalogEventsExchange() {
        return new TopicExchange("catalog.events", true, false);
    }

    @Bean
    TopicExchange analyticsBookingEventsExchange() {
        return new TopicExchange("booking.events", true, false);
    }

    @Bean
    DirectExchange analyticsDeadLetterExchange() {
        return new DirectExchange(DEAD_LETTER_EXCHANGE, true, false);
    }

    @Bean
    Queue analyticsCatalogQueue(
        @Value("${analytics.messaging.catalog-queue:analytics.catalog.v1}") String queueName
    ) {
        return eventQueue(queueName);
    }

    @Bean
    Queue analyticsBookingQueue(
        @Value("${analytics.messaging.booking-queue:analytics.booking.v1}") String queueName
    ) {
        return eventQueue(queueName);
    }

    @Bean
    Queue analyticsCatalogDeadLetterQueue(
        @Value("${analytics.messaging.catalog-queue:analytics.catalog.v1}") String queueName
    ) {
        return QueueBuilder.durable(deadLetterQueueName(queueName)).build();
    }

    @Bean
    Queue analyticsBookingDeadLetterQueue(
        @Value("${analytics.messaging.booking-queue:analytics.booking.v1}") String queueName
    ) {
        return QueueBuilder.durable(deadLetterQueueName(queueName)).build();
    }

    @Bean
    Binding analyticsMovieEventsBinding(Queue analyticsCatalogQueue, TopicExchange analyticsCatalogEventsExchange) {
        return BindingBuilder.bind(analyticsCatalogQueue).to(analyticsCatalogEventsExchange).with("movie.*");
    }

    @Bean
    Binding analyticsOrderEventsBinding(Queue analyticsBookingQueue, TopicExchange analyticsBookingEventsExchange) {
        return BindingBuilder.bind(analyticsBookingQueue).to(analyticsBookingEventsExchange).with("order.*");
    }

    @Bean
    Binding analyticsCatalogDeadLetterBinding(
        Queue analyticsCatalogDeadLetterQueue,
        DirectExchange analyticsDeadLetterExchange,
        @Value("${analytics.messaging.catalog-queue:analytics.catalog.v1}") String queueName
    ) {
        return BindingBuilder.bind(analyticsCatalogDeadLetterQueue)
            .to(analyticsDeadLetterExchange)
            .with(queueName);
    }

    @Bean
    Binding analyticsBookingDeadLetterBinding(
        Queue analyticsBookingDeadLetterQueue,
        DirectExchange analyticsDeadLetterExchange,
        @Value("${analytics.messaging.booking-queue:analytics.booking.v1}") String queueName
    ) {
        return BindingBuilder.bind(analyticsBookingDeadLetterQueue)
            .to(analyticsDeadLetterExchange)
            .with(queueName);
    }

    private Queue eventQueue(String queueName) {
        return QueueBuilder.durable(queueName)
            .deadLetterExchange(DEAD_LETTER_EXCHANGE)
            .deadLetterRoutingKey(queueName)
            .build();
    }

    private String deadLetterQueueName(String queueName) {
        return queueName + ".dlq";
    }
}
