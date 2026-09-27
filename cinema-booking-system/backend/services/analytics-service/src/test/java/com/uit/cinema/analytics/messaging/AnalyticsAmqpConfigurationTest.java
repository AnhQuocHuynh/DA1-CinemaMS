package com.uit.cinema.analytics.messaging;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import static org.assertj.core.api.Assertions.assertThat;

class AnalyticsAmqpConfigurationTest {

    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
        .withPropertyValues("analytics.messaging.enabled=true")
        .withUserConfiguration(AnalyticsAmqpConfiguration.class);

    @Test
    void createsAllConsumerAndDeadLetterBindingsWithoutAmbiguity() {
        contextRunner.run(context -> {
            assertThat(context).hasNotFailed();
            assertThat(context).hasBean("analyticsMovieEventsBinding");
            assertThat(context).hasBean("analyticsOrderEventsBinding");
            assertThat(context).hasBean("analyticsCatalogDeadLetterBinding");
            assertThat(context).hasBean("analyticsBookingDeadLetterBinding");
        });
    }
}
