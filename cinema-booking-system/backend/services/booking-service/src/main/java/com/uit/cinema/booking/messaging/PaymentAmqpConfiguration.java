package com.uit.cinema.booking.messaging;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.DirectExchange;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.QueueBuilder;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConditionalOnProperty(name = "booking.messaging.payment-events.enabled", havingValue = "true")
public class PaymentAmqpConfiguration {

    static final String DEAD_LETTER_EXCHANGE = "cinema.events.dlx";
    static final String PAYMENT_EVENTS_EXCHANGE = "payment.events";

    @Bean
    TopicExchange bookingPaymentEventsExchange() {
        return new TopicExchange(PAYMENT_EVENTS_EXCHANGE, true, false);
    }

    @Bean
    DirectExchange bookingPaymentDeadLetterExchange() {
        return new DirectExchange(DEAD_LETTER_EXCHANGE, true, false);
    }

    @Bean
    Queue bookingPaymentCompletedQueue(
        @Value("${booking.messaging.payment-events.completed-queue:booking.payment.completed.v1}") String queueName
    ) {
        return eventQueue(queueName);
    }

    @Bean
    Queue bookingPaymentFailedQueue(
        @Value("${booking.messaging.payment-events.failed-queue:booking.payment.failed.v1}") String queueName
    ) {
        return eventQueue(queueName);
    }

    @Bean
    Queue bookingPaymentRefundedQueue(
        @Value("${booking.messaging.payment-events.refunded-queue:booking.payment.refunded.v1}") String queueName
    ) {
        return eventQueue(queueName);
    }

    @Bean
    Queue bookingPaymentCompletedDeadLetterQueue(
        @Value("${booking.messaging.payment-events.completed-queue:booking.payment.completed.v1}") String queueName
    ) {
        return QueueBuilder.durable(deadLetterQueueName(queueName)).build();
    }

    @Bean
    Queue bookingPaymentFailedDeadLetterQueue(
        @Value("${booking.messaging.payment-events.failed-queue:booking.payment.failed.v1}") String queueName
    ) {
        return QueueBuilder.durable(deadLetterQueueName(queueName)).build();
    }

    @Bean
    Queue bookingPaymentRefundedDeadLetterQueue(
        @Value("${booking.messaging.payment-events.refunded-queue:booking.payment.refunded.v1}") String queueName
    ) {
        return QueueBuilder.durable(deadLetterQueueName(queueName)).build();
    }

    @Bean
    Binding bookingPaymentCompletedBinding(
        @Qualifier("bookingPaymentCompletedQueue") Queue bookingPaymentCompletedQueue,
        @Qualifier("bookingPaymentEventsExchange") TopicExchange bookingPaymentEventsExchange
    ) {
        return BindingBuilder.bind(bookingPaymentCompletedQueue)
            .to(bookingPaymentEventsExchange)
            .with("payment.completed");
    }

    @Bean
    Binding bookingPaymentFailedBinding(
        @Qualifier("bookingPaymentFailedQueue") Queue bookingPaymentFailedQueue,
        @Qualifier("bookingPaymentEventsExchange") TopicExchange bookingPaymentEventsExchange
    ) {
        return BindingBuilder.bind(bookingPaymentFailedQueue)
            .to(bookingPaymentEventsExchange)
            .with("payment.failed");
    }

    @Bean
    Binding bookingPaymentRefundedBinding(
        @Qualifier("bookingPaymentRefundedQueue") Queue bookingPaymentRefundedQueue,
        @Qualifier("bookingPaymentEventsExchange") TopicExchange bookingPaymentEventsExchange
    ) {
        return BindingBuilder.bind(bookingPaymentRefundedQueue)
            .to(bookingPaymentEventsExchange)
            .with("payment.refunded");
    }

    @Bean
    Binding bookingPaymentCompletedDeadLetterBinding(
        @Qualifier("bookingPaymentCompletedDeadLetterQueue") Queue bookingPaymentCompletedDeadLetterQueue,
        @Qualifier("bookingPaymentDeadLetterExchange") DirectExchange bookingPaymentDeadLetterExchange,
        @Value("${booking.messaging.payment-events.completed-queue:booking.payment.completed.v1}") String queueName
    ) {
        return BindingBuilder.bind(bookingPaymentCompletedDeadLetterQueue)
            .to(bookingPaymentDeadLetterExchange)
            .with(queueName);
    }

    @Bean
    Binding bookingPaymentFailedDeadLetterBinding(
        @Qualifier("bookingPaymentFailedDeadLetterQueue") Queue bookingPaymentFailedDeadLetterQueue,
        @Qualifier("bookingPaymentDeadLetterExchange") DirectExchange bookingPaymentDeadLetterExchange,
        @Value("${booking.messaging.payment-events.failed-queue:booking.payment.failed.v1}") String queueName
    ) {
        return BindingBuilder.bind(bookingPaymentFailedDeadLetterQueue)
            .to(bookingPaymentDeadLetterExchange)
            .with(queueName);
    }

    @Bean
    Binding bookingPaymentRefundedDeadLetterBinding(
        @Qualifier("bookingPaymentRefundedDeadLetterQueue") Queue bookingPaymentRefundedDeadLetterQueue,
        @Qualifier("bookingPaymentDeadLetterExchange") DirectExchange bookingPaymentDeadLetterExchange,
        @Value("${booking.messaging.payment-events.refunded-queue:booking.payment.refunded.v1}") String queueName
    ) {
        return BindingBuilder.bind(bookingPaymentRefundedDeadLetterQueue)
            .to(bookingPaymentDeadLetterExchange)
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
