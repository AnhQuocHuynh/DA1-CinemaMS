package com.uit.cinema.booking.messaging;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import static org.assertj.core.api.Assertions.assertThat;

class PaymentAmqpConfigurationTest {

    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
        .withPropertyValues("booking.messaging.payment-events.enabled=true")
        .withUserConfiguration(PaymentAmqpConfiguration.class);

    @Test
    void createsConsumerAndDeadLetterBindingsWithoutAmbiguity() {
        contextRunner.run(context -> {
            assertThat(context).hasNotFailed();
            assertThat(context).hasBean("bookingPaymentCompletedBinding");
            assertThat(context).hasBean("bookingPaymentFailedBinding");
            assertThat(context).hasBean("bookingPaymentRefundedBinding");
            assertThat(context).hasBean("bookingPaymentCompletedDeadLetterBinding");
            assertThat(context).hasBean("bookingPaymentFailedDeadLetterBinding");
            assertThat(context).hasBean("bookingPaymentRefundedDeadLetterBinding");
        });
    }

    @Test
    void staysDisabledByDefault() {
        new ApplicationContextRunner()
            .withUserConfiguration(PaymentAmqpConfiguration.class)
            .run(context -> {
                assertThat(context).hasNotFailed();
                assertThat(context).doesNotHaveBean("bookingPaymentCompletedQueue");
            });
    }
}
