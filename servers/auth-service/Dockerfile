FROM rust:1.89 as builder

WORKDIR /app
COPY . .
RUN cargo build --release --bin radiate-auth-service

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/target/release/radiate-auth-service /usr/local/bin/
EXPOSE 14701
CMD ["radiate-auth-service"]