use axum::{extract::{ws::{Message, WebSocket, WebSocketUpgrade}, Query}, response::IntoResponse, routing::get, Router};
use lapin::{options::*, types::FieldTable, Connection, ConnectionProperties};
use rscord_common::{load_config, AppConfig};
use std::net::SocketAddr;
use tokio::net::TcpListener;
use tracing::info;
use serde::Deserialize;
use futures_util::StreamExt;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    let cfg: AppConfig = load_config("RSCORD").expect("load config");
    let addr: SocketAddr = cfg
        .bind_addr
        .as_deref()
        .unwrap_or("127.0.0.1:14703")
        .parse()
        .expect("bind addr");

    let app = Router::new().route("/health", get(|| async { "ok" })).route("/ws", get(ws_handler));

    info!("rscord-events listening on {}", addr);
    let listener = TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

#[derive(Deserialize)]
struct WsQuery { token: Option<String> }

async fn ws_handler(Query(q): Query<WsQuery>, ws: WebSocketUpgrade) -> impl IntoResponse {
    // Verify JWT if provided (optional here; can make mandatory)
    let _ = q.token.as_deref();
    ws.on_upgrade(handle_ws)
}

async fn handle_ws(mut socket: WebSocket) {
    // Connect to RabbitMQ and bind a temporary queue for this connection
    let cfg = load_config("RSCORD").expect("cfg");
    let conn = Connection::connect(&cfg.rabbitmq_uri.expect("RabbitMQ URI not configured"), ConnectionProperties::default())
        .await
        .expect("amqp");
    let channel = conn.create_channel().await.expect("ch");
    channel
        .exchange_declare(
            "rscord.events",
            lapin::ExchangeKind::Topic,
            ExchangeDeclareOptions { durable: true, ..Default::default() },
            FieldTable::default(),
        )
        .await
        .ok();
    let q = channel
        .queue_declare(
            "",
            QueueDeclareOptions { exclusive: true, durable: false, auto_delete: true, ..Default::default() },
            FieldTable::default(),
        )
        .await
        .expect("queue");
    // Bind to all events for now; later bind by guild/channel
    let _ = channel
        .queue_bind(
            &q.name().as_str(),
            "rscord.events",
            "#.created",
            QueueBindOptions::default(),
            FieldTable::default(),
        )
        .await;
    let _ = channel
        .queue_bind(
            &q.name().as_str(),
            "rscord.events",
            "#.updated",
            QueueBindOptions::default(),
            FieldTable::default(),
        )
        .await;
    let _ = channel
        .queue_bind(
            &q.name().as_str(),
            "rscord.events",
            "#.deleted",
            QueueBindOptions::default(),
            FieldTable::default(),
        )
        .await;

    let mut consumer = channel
        .basic_consume(
            &q.name().as_str(),
            "events",
            BasicConsumeOptions::default(),
            FieldTable::default(),
        )
        .await
        .expect("consumer");

    loop {
        tokio::select! {
            maybe_msg = socket.recv() => {
                if let Some(Ok(Message::Close(_))) | None = maybe_msg { break; }
            }
            delivery = consumer.next() => {
                if let Some(Ok(delivery)) = delivery {
                    if let Ok(txt) = std::str::from_utf8(&delivery.data) {
                        let _ = socket.send(Message::Text(txt.to_string())).await;
                    }
                    let _ = delivery.ack(BasicAckOptions::default()).await;
                } else {
                    break;
                }
            }
        }
    }
}


