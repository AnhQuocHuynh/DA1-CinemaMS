package com.uit.cinema.core.config;

import io.micrometer.observation.ObservationPredicate;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.server.observation.ServerRequestObservationContext;

@Configuration(proxyBeanMethods = false)
public class ObservabilityConfig {

    @Bean
    @ConditionalOnClass(ServerRequestObservationContext.class)
    public ObservationPredicate ignoreActuatorAndHealthChecks() {
        return (name, context) -> {
            if (context instanceof ServerRequestObservationContext serverContext) {
                String uri = serverContext.getCarrier().getRequestURI();
                return uri == null || (!uri.contains("/actuator") && !uri.contains("/health"));
            }
            return true;
        };
    }
}
