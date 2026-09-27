FROM maven:3.9.9-eclipse-temurin-21 AS build

WORKDIR /workspace

COPY pom.xml pom.xml
COPY services/catalog-service/pom.xml services/catalog-service/pom.xml

COPY services/showtime-service/pom.xml services/showtime-service/pom.xml
COPY services/booking-service/pom.xml services/booking-service/pom.xml
COPY services/analytics-service/pom.xml services/analytics-service/pom.xml
COPY services/recommendation-service/pom.xml services/recommendation-service/pom.xml
COPY services/analytics-service/src services/analytics-service/src
RUN --mount=type=cache,target=/root/.m2,sharing=locked mvn -q -pl services/analytics-service -am package -Dmaven.test.skip=true

FROM eclipse-temurin:21-jre

WORKDIR /app

RUN useradd --system --create-home --uid 10001 appuser
COPY --from=build /workspace/services/analytics-service/target/analytics-service-*.jar /app/app.jar

USER appuser
EXPOSE 8084

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
