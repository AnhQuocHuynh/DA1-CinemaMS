package com.uit.cinema.recommendation.messaging;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import static org.assertj.core.api.Assertions.assertThat;

class RecommendationAmqpConfigurationTest {

    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
        .withPropertyValues("recommendation.messaging.enabled=true")
        .withUserConfiguration(RecommendationAmqpConfiguration.class);

    @Test
    void createsAllConsumerAndDeadLetterBindingsWithoutAmbiguity() {
        contextRunner.run(context -> {
            assertThat(context).hasNotFailed();
            assertThat(context).hasBean("recommendationMovieEventsBinding");
            assertThat(context).hasBean("recommendationOrderEventsBinding");
            assertThat(context).hasBean("recommendationReviewEventsBinding");
            assertThat(context).hasBean("recommendationCatalogDeadLetterBinding");
            assertThat(context).hasBean("recommendationBookingDeadLetterBinding");
        });
    }
}
