FROM maven:3.9.9-eclipse-temurin-21 AS build

WORKDIR /workspace

COPY pom.xml pom.xml
COPY services/catalog-service/pom.xml services/catalog-service/pom.xml
COPY services/facility-service/pom.xml services/facility-service/pom.xml
COPY services/showtime-service/pom.xml services/showtime-service/pom.xml
RUN mvn -q -pl services/showtime-service -am dependency:go-offline

COPY services/showtime-service/src services/showtime-service/src
RUN mvn -q -pl services/showtime-service -am package -DskipTests

FROM eclipse-temurin:21-jre

WORKDIR /app

RUN useradd --system --create-home --uid 10001 appuser
COPY --from=build /workspace/services/showtime-service/target/showtime-service-*.jar /app/app.jar

USER appuser
EXPOSE 8082

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
