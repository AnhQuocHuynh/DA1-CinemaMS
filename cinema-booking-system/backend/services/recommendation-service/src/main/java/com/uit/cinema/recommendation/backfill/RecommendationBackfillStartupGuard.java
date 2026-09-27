package com.uit.cinema.recommendation.backfill;

import org.springframework.beans.factory.InitializingBean;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "recommendation.backfill.enabled", havingValue = "true")
public class RecommendationBackfillStartupGuard implements InitializingBean {

    private final boolean graphEnabled;

    public RecommendationBackfillStartupGuard(
        @Value("${recommendation.graph.enabled:false}") boolean graphEnabled
    ) {
        this.graphEnabled = graphEnabled;
    }

    @Override
    public void afterPropertiesSet() {
        if (!graphEnabled) {
            throw new IllegalStateException(
                "recommendation.backfill.enabled requires recommendation.graph.enabled=true"
            );
        }
    }
}
