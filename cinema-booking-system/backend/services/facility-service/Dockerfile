FROM maven:3.9.9-eclipse-temurin-21 AS build

WORKDIR /workspace

COPY pom.xml pom.xml
COPY services/catalog-service/pom.xml services/catalog-service/pom.xml
COPY services/facility-service/pom.xml services/facility-service/pom.xml
COPY services/showtime-service/pom.xml services/showtime-service/pom.xml
RUN mvn -q -pl services/facility-service -am dependency:go-offline

COPY services/facility-service/src services/facility-service/src
RUN mvn -q -pl services/facility-service -am package -DskipTests

FROM eclipse-temurin:21-jre

WORKDIR /app

RUN useradd --system --create-home --uid 10001 appuser
COPY --from=build /workspace/services/facility-service/target/facility-service-*.jar /app/app.jar

USER appuser
EXPOSE 5002

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
