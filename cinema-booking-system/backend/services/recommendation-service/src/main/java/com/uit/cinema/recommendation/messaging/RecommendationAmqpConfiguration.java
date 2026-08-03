package com.uit.cinema.recommendation.messaging;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.DirectExchange;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.QueueBuilder;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConditionalOnProperty(name = "recommendation.messaging.enabled", havingValue = "true")
public class RecommendationAmqpConfiguration {

    static final String DEAD_LETTER_EXCHANGE = "cinema.events.dlx";

    @Bean
    TopicExchange recommendationCatalogEventsExchange() {
        return new TopicExchange("catalog.events", true, false);
    }

    @Bean
    TopicExchange recommendationBookingEventsExchange() {
        return new TopicExchange("booking.events", true, false);
    }

    @Bean
    DirectExchange recommendationDeadLetterExchange() {
        return new DirectExchange(DEAD_LETTER_EXCHANGE, true, false);
    }

    @Bean
    Queue recommendationCatalogQueue(
        @Value("${recommendation.messaging.catalog-queue:recommendation.catalog.v1}") String queueName
    ) {
        return eventQueue(queueName);
    }

    @Bean
    Queue recommendationBookingQueue(
        @Value("${recommendation.messaging.booking-queue:recommendation.booking.v1}") String queueName
    ) {
        return eventQueue(queueName);
    }

    @Bean
    Queue recommendationCatalogDeadLetterQueue(
        @Value("${recommendation.messaging.catalog-queue:recommendation.catalog.v1}") String queueName
    ) {
        return QueueBuilder.durable(queueName + ".dlq").build();
    }

    @Bean
    Queue recommendationBookingDeadLetterQueue(
        @Value("${recommendation.messaging.booking-queue:recommendation.booking.v1}") String queueName
    ) {
        return QueueBuilder.durable(queueName + ".dlq").build();
    }

    @Bean
    Binding recommendationMovieEventsBinding(
        @Qualifier("recommendationCatalogQueue") Queue recommendationCatalogQueue,
        @Qualifier("recommendationCatalogEventsExchange") TopicExchange recommendationCatalogEventsExchange
    ) {
        return BindingBuilder.bind(recommendationCatalogQueue).to(recommendationCatalogEventsExchange).with("movie.*");
    }

    @Bean
    Binding recommendationOrderEventsBinding(
        @Qualifier("recommendationBookingQueue") Queue recommendationBookingQueue,
        @Qualifier("recommendationBookingEventsExchange") TopicExchange recommendationBookingEventsExchange
    ) {
        return BindingBuilder.bind(recommendationBookingQueue).to(recommendationBookingEventsExchange).with("order.*");
    }

    @Bean
    Binding recommendationReviewEventsBinding(
        @Qualifier("recommendationBookingQueue") Queue recommendationBookingQueue,
        @Qualifier("recommendationBookingEventsExchange") TopicExchange recommendationBookingEventsExchange
    ) {
        return BindingBuilder.bind(recommendationBookingQueue).to(recommendationBookingEventsExchange).with("review.created");
    }

    @Bean
    Binding recommendationCatalogDeadLetterBinding(
        @Qualifier("recommendationCatalogDeadLetterQueue") Queue recommendationCatalogDeadLetterQueue,
        @Qualifier("recommendationDeadLetterExchange") DirectExchange recommendationDeadLetterExchange,
        @Value("${recommendation.messaging.catalog-queue:recommendation.catalog.v1}") String queueName
    ) {
        return BindingBuilder.bind(recommendationCatalogDeadLetterQueue)
            .to(recommendationDeadLetterExchange)
            .with(queueName);
    }

    @Bean
    Binding recommendationBookingDeadLetterBinding(
        @Qualifier("recommendationBookingDeadLetterQueue") Queue recommendationBookingDeadLetterQueue,
        @Qualifier("recommendationDeadLetterExchange") DirectExchange recommendationDeadLetterExchange,
        @Value("${recommendation.messaging.booking-queue:recommendation.booking.v1}") String queueName
    ) {
        return BindingBuilder.bind(recommendationBookingDeadLetterQueue)
            .to(recommendationDeadLetterExchange)
            .with(queueName);
    }

    private Queue eventQueue(String queueName) {
        return QueueBuilder.durable(queueName)
            .deadLetterExchange(DEAD_LETTER_EXCHANGE)
            .deadLetterRoutingKey(queueName)
            .build();
    }
}
