FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN mvn -B -DskipTests package

FROM eclipse-temurin:17-jre-alpine
RUN addgroup -S shop && adduser -S shop -G shop
WORKDIR /app
COPY --from=build /app/target/freshshop-1.0.0.jar app.jar
USER shop
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
