package com.uit.cinema.recommendation.messaging;

import org.springframework.beans.factory.InitializingBean;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "recommendation.messaging.enabled", havingValue = "true")
public class RecommendationMessagingStartupGuard implements InitializingBean {

    private final boolean graphEnabled;

    public RecommendationMessagingStartupGuard(
        @Value("${recommendation.graph.enabled:false}") boolean graphEnabled
    ) {
        this.graphEnabled = graphEnabled;
    }

    @Override
    public void afterPropertiesSet() {
        if (!graphEnabled) {
            throw new IllegalStateException(
                "recommendation.messaging.enabled requires recommendation.graph.enabled=true"
            );
        }
    }
}
