# Spring Boot Microservice Observability Integration

Spring Boot 3 has excellent, native support for the LGTM (Loki, Grafana, Tempo, Mimir/Prometheus) and OpenTelemetry (OTel) stack via Micrometer and OpenTelemetry. 

You have two options: **Micrometer Tracing** (native Spring 3 approach) or the **OpenTelemetry Java Agent** (zero-code instrumentation).

## Option A: Zero-Code Instrumentation (Recommended for quick setup)

Simply attach the OTel Java Agent when starting your Spring Boot app. You don't even need to modify your code!

```bash
java -javaagent:path/to/opentelemetry-javaagent.jar \
     -Dotel.service.name=my-spring-boot-service \
     -Dotel.exporter.otlp.endpoint=http://localhost:4317 \
     -Dotel.instrumentation.common.default-predicate.excluded-url-paths=/actuator/health \
     -jar myapp.jar
```

## Option B: Spring Boot 3 Micrometer Integration

If you prefer adding dependencies, include these in your `pom.xml` / `build.gradle`:

```xml
<dependency>
    <groupId>io.micrometer</groupId>
    <artifactId>micrometer-registry-otlp</artifactId>
</dependency>
<dependency>
    <groupId>io.micrometer</groupId>
    <artifactId>micrometer-tracing-bridge-otel</artifactId>
</dependency>
<dependency>
    <groupId>io.opentelemetry</groupId>
    <artifactId>opentelemetry-exporter-otlp</artifactId>
</dependency>
```

Then in `application.yml`, just point it to the Collector:
```yaml
management:
  otlp:
    tracing:
      endpoint: http://localhost:4317
    metrics:
      export:
        url: http://localhost:4318/v1/metrics
```

### Dropping Health Check Traces (Micrometer)
To prevent `/actuator/health` pings from spamming your traces, you need to define an `ObservationPredicate` Bean to drop them:

```java
import io.micrometer.observation.ObservationPredicate;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.server.observation.ServerRequestObservationContext;

@Configuration
public class ObservabilityConfig {
    @Bean
    public ObservationPredicate ignoreActuator() {
        return (name, context) -> {
            if (context instanceof ServerRequestObservationContext serverContext) {
                return !serverContext.getCarrier().getRequestURI().contains("health");
            }
            return true;
        };
    }
}
```
