FROM rust:1.89 as builder

WORKDIR /app
COPY . .
RUN cargo build --release --bin radiate-telegram-bot

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/target/release/radiate-telegram-bot /usr/local/bin/
CMD ["radiate-telegram-bot"]