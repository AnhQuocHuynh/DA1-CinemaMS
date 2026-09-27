package com.uit.cinema.recommendation.backfill;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.uit.cinema.recommendation.messaging.RecommendationEventProjectionStore;
import org.junit.jupiter.api.Test;
import org.neo4j.driver.Driver;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;

class RecommendationGraphBackfillRunnerTest {

    @Test
    void nonDryRun_requiresExactConfirmationBeforeOpeningSourceOrGraph() {
        RecommendationEventProjectionStore projectionStore = mock(RecommendationEventProjectionStore.class);
        Driver graphDriver = mock(Driver.class);
        RecommendationGraphBackfillRunner runner = new RecommendationGraphBackfillRunner(
            new ObjectMapper(),
            projectionStore,
            graphDriver,
            false,
            "wrong-confirmation",
            "jdbc:postgresql://unreachable/cinema_db",
            "postgres",
            "",
            500
        );

        assertThatThrownBy(() -> runner.run(null))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining(RecommendationGraphBackfillRunner.REQUIRED_CONFIRMATION);

        verifyNoInteractions(projectionStore, graphDriver);
    }
}
