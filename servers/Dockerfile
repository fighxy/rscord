# Multi-stage build for Rust microservices
FROM rust:1.75 as builder

WORKDIR /app

# Copy workspace files
COPY Cargo.toml Cargo.lock ./
COPY crates/ ./crates/

# Create placeholder source files for all services to enable dependency caching
RUN mkdir -p gateway/src auth-service/src chat-service/src voice-service/src presence-service/src signaling/src
RUN echo "fn main() {}" > gateway/src/main.rs
RUN echo "fn main() {}" > auth-service/src/main.rs
RUN echo "fn main() {}" > chat-service/src/main.rs
RUN echo "fn main() {}" > voice-service/src/main.rs
RUN echo "fn main() {}" > presence-service/src/main.rs
RUN echo "fn main() {}" > signaling/src/main.rs

# Copy service Cargo.toml files
COPY gateway/Cargo.toml ./gateway/
COPY auth-service/Cargo.toml ./auth-service/
COPY chat-service/Cargo.toml ./chat-service/
COPY voice-service/Cargo.toml ./voice-service/
COPY presence-service/Cargo.toml ./presence-service/
COPY signaling/Cargo.toml ./signaling/

# Build dependencies
RUN cargo build --release
RUN rm -rf */src target/release/deps/radiate*

# Copy actual source code
COPY gateway/src ./gateway/src
COPY auth-service/src ./auth-service/src
COPY chat-service/src ./chat-service/src
COPY voice-service/src ./voice-service/src
COPY presence-service/src ./presence-service/src
COPY signaling/src ./signaling/src

# Build argument to specify which service to build
ARG SERVICE_NAME
RUN cargo build --release --bin $SERVICE_NAME

# Runtime stage
FROM debian:bookworm-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

# Create app user
RUN useradd -r -s /bin/false appuser

WORKDIR /app

# Copy binary based on build argument
ARG SERVICE_NAME
COPY --from=builder /app/target/release/$SERVICE_NAME ./service

# Copy configuration
COPY radiate.toml ./

# Switch to app user
USER appuser

# Expose port (will be overridden by docker-compose)
EXPOSE 8080

# Run the service
CMD ["./service"]
