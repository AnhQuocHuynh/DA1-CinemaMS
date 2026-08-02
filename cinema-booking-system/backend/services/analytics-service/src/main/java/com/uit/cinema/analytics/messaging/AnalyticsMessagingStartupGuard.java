package com.uit.cinema.analytics.messaging;

import org.springframework.beans.factory.InitializingBean;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "analytics.messaging.enabled", havingValue = "true")
public class AnalyticsMessagingStartupGuard implements InitializingBean {

    private final boolean readModelEnabled;

    public AnalyticsMessagingStartupGuard(
        @Value("${analytics.read-model.enabled:false}") boolean readModelEnabled
    ) {
        this.readModelEnabled = readModelEnabled;
    }

    @Override
    public void afterPropertiesSet() {
        if (!readModelEnabled) {
            throw new IllegalStateException(
                "analytics.messaging.enabled requires analytics.read-model.enabled=true"
            );
        }
    }
}
