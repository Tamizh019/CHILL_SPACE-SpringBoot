# Build Stage
# Use a Maven image to build the app (no need for local mvnw)
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
COPY src ./src
COPY knowledge ./knowledge
RUN mvn clean package -DskipTests

# Run Stage
# Use a smaller JRE image to run the app
FROM eclipse-temurin:17-jdk-jammy
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
COPY --from=build /app/knowledge ./knowledge
EXPOSE 9195
ENTRYPOINT ["java", "-jar", "app.jar"]
