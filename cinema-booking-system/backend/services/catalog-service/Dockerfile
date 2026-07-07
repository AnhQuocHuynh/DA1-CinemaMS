FROM maven:3.9.9-eclipse-temurin-21 AS build

WORKDIR /workspace

COPY pom.xml pom.xml
COPY services/catalog-service/pom.xml services/catalog-service/pom.xml
COPY services/facility-service/pom.xml services/facility-service/pom.xml
COPY services/showtime-service/pom.xml services/showtime-service/pom.xml
COPY services/booking-service/pom.xml services/booking-service/pom.xml
RUN mvn -q -pl services/catalog-service -am dependency:go-offline

COPY services/catalog-service/src services/catalog-service/src
RUN mvn -q -pl services/catalog-service -am package -DskipTests

FROM eclipse-temurin:21-jre

WORKDIR /app

RUN useradd --system --create-home --uid 10001 appuser
COPY --from=build /workspace/services/catalog-service/target/catalog-service-*.jar /app/app.jar

USER appuser
EXPOSE 8081

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
