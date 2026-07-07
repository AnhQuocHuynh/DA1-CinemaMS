FROM maven:3.9.9-eclipse-temurin-21 AS build

WORKDIR /workspace

COPY pom.xml pom.xml
COPY services/catalog-service/pom.xml services/catalog-service/pom.xml
COPY services/facility-service/pom.xml services/facility-service/pom.xml
COPY services/showtime-service/pom.xml services/showtime-service/pom.xml
COPY services/booking-service/pom.xml services/booking-service/pom.xml
RUN mvn -q -pl services/booking-service -am dependency:go-offline

COPY services/booking-service/src services/booking-service/src
RUN mvn -q -pl services/booking-service -am package -DskipTests

FROM eclipse-temurin:21-jre

WORKDIR /app

RUN useradd --system --create-home --uid 10001 appuser
COPY --from=build /workspace/services/booking-service/target/booking-service-*.jar /app/app.jar

USER appuser
EXPOSE 8083

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
