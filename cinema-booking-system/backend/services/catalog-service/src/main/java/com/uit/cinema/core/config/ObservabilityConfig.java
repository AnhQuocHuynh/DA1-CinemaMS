package com.uit.cinema.core.config;

import io.micrometer.observation.ObservationPredicate;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
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

    @Configuration(proxyBeanMethods = false)
    @ConditionalOnClass(name = "org.springframework.amqp.rabbit.core.RabbitTemplate")
    static class RabbitObservabilityConfiguration {

        @Bean
        public org.springframework.boot.autoconfigure.amqp.RabbitTemplateCustomizer rabbitTemplateObservationCustomizer() {
            return rabbitTemplate -> rabbitTemplate.setObservationEnabled(true);
        }

        @Bean
        @ConditionalOnMissingBean(name = "rabbitListenerContainerFactory")
        public org.springframework.amqp.rabbit.config.SimpleRabbitListenerContainerFactory rabbitListenerContainerFactory(
                org.springframework.amqp.rabbit.connection.ConnectionFactory connectionFactory,
                org.springframework.boot.autoconfigure.amqp.SimpleRabbitListenerContainerFactoryConfigurer configurer) {
            org.springframework.amqp.rabbit.config.SimpleRabbitListenerContainerFactory factory =
                    new org.springframework.amqp.rabbit.config.SimpleRabbitListenerContainerFactory();
            configurer.configure(factory, connectionFactory);
            factory.setObservationEnabled(true);
            return factory;
        }
    }
}
