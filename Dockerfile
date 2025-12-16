# Use an official OpenJDK runtime as a parent image
FROM openjdk:17-jdk-slim

# Set the working directory in the container
WORKDIR /app

# Copy the project's POM file and source code
COPY pom.xml .
COPY src ./src
COPY .mvn ./.mvn
COPY mvnw .

# Build the application
# Note: We skip tests to speed up the build in the container. 
# In a real pipeline, you should run tests.
RUN ./mvnw clean package -DskipTests

# Copy the built jar to the current directory
# Adjust the jar name if it's different in your pom.xml (e.g., backend-0.0.1-SNAPSHOT.jar)
RUN cp target/*.jar app.jar

# Expose the port the app runs on
EXPOSE 9195

# Run the jar file
ENTRYPOINT ["java", "-jar", "app.jar"]
