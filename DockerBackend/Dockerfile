# =============================================================================
# DockerBackend/Dockerfile — Spring Boot API
#
# This is a MULTI-STAGE build: two FROM lines = two stages.
#   Stage 1 ("build")   has Maven + a full JDK → compiles the code into a .jar
#   Stage 2 (runtime)   has only a slim JRE   → just runs the .jar
# Only stage 2 ends up in the final image, so Maven, the JDK, the source code
# and the ~100 MB of downloaded dependencies are all left behind.
# =============================================================================

# ---------- Stage 1: build the jar ----------
# FROM picks the base image. This one already has Maven 3.9 and JDK 21 installed.
# "AS build" gives the stage a name so stage 2 can copy files out of it.
FROM maven:3.9-eclipse-temurin-21 AS build

# WORKDIR creates the folder (if needed) and cd's into it for every later instruction.
WORKDIR /app

# Copy ONLY pom.xml first. Docker caches each instruction as a "layer".
# As long as pom.xml doesn't change, the next RUN (downloading dependencies)
# is served from cache — so editing Java code doesn't re-download the internet.
COPY pom.xml .

# Download all dependencies into the image's Maven cache.
# -B = batch mode (less noisy output, no colors).
RUN mvn -B dependency:go-offline

# NOW copy the source code. Changing a .java file only invalidates the cache
# from this line downwards.
COPY src ./src

# Compile and package the app into target/*.jar.
# -DskipTests: tests would need a running database, which doesn't exist during a build.
RUN mvn -B package -DskipTests


# ---------- Stage 2: run the jar ----------
# A slim image with only the Java Runtime (no compiler, no Maven).
FROM eclipse-temurin:21-jre

WORKDIR /app

# Create a regular (non-root) user. If someone ever breaks into the app,
# they won't be root inside the container.
RUN groupadd --system spring && useradd --system --gid spring spring

# Copy ONLY the built jar out of the "build" stage. Nothing else comes along.
COPY --from=build /app/target/*.jar app.jar

# Switch to the non-root user for everything that runs from here on.
USER spring

# EXPOSE is documentation: "this container listens on 8080".
# It does NOT publish the port to your computer — that's what `-p 8080:8080` does.
EXPOSE 8080

# The command that runs when the container starts.
# Exec form (JSON array) makes java PID 1, so it receives Ctrl+C / docker stop signals.
ENTRYPOINT ["java", "-jar", "app.jar"]
