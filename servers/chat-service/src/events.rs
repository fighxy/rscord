use anyhow::Result;
use lapin::{
    options::*, publisher_confirm::Confirmation, types::FieldTable, BasicProperties, Connection,
    ConnectionProperties, Channel,
};
use rscord_events::ChatEvent;
use serde_json;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{error, info};

pub struct EventPublisher {
    channel: Arc<RwLock<Option<Channel>>>,
}

impl EventPublisher {
    pub async fn new() -> Result<Self> {
        // Try to connect to RabbitMQ, but don't fail if it's not available
        let channel = match Self::connect().await {
            Ok(ch) => Some(ch),
            Err(e) => {
                error!("Failed to connect to RabbitMQ: {}. Events will not be published.", e);
                None
            }
        };

        Ok(Self {
            channel: Arc::new(RwLock::new(channel)),
        })
    }

    async fn connect() -> Result<Channel> {
        let addr = std::env::var("RABBITMQ_URL").unwrap_or_else(|_| "amqp://127.0.0.1:5672".to_string());
        
        let conn = Connection::connect(&addr, ConnectionProperties::default()).await?;
        let channel = conn.create_channel().await?;

        // Declare exchange for chat events
        channel
            .exchange_declare(
                "chat_events",
                lapin::ExchangeKind::Topic,
                ExchangeDeclareOptions {
                    durable: true,
                    auto_delete: false,
                    internal: false,
                    nowait: false,
                },
                FieldTable::default(),
            )
            .await?;

        info!("Connected to RabbitMQ and declared chat_events exchange");
        Ok(channel)
    }

    pub async fn publish_event(&self, event: ChatEvent) -> Result<()> {
        let channel_lock = self.channel.read().await;
        if let Some(ref channel) = *channel_lock {
            let routing_key = match &event {
                ChatEvent::MessageCreated { .. } => "message.created",
                ChatEvent::MessageUpdated { .. } => "message.updated",
                ChatEvent::MessageDeleted { .. } => "message.deleted",
                ChatEvent::UserJoined { .. } => "user.joined",
                ChatEvent::UserLeft { .. } => "user.left",
                ChatEvent::TypingStarted { .. } => "typing.started",
                ChatEvent::TypingEnded { .. } => "typing.ended",
            };

            let payload = serde_json::to_vec(&event)?;

            let _confirmation = channel
                .basic_publish(
                    "chat_events",
                    routing_key,
                    BasicPublishOptions::default(),
                    &payload,
                    BasicProperties::default(),
                )
                .await?
                .await?;

            info!("Published event: {} to routing key: {}", serde_json::to_string(&event)?, routing_key);
        } else {
            // If RabbitMQ is not available, just log the event
            info!("Event not published (RabbitMQ unavailable): {:?}", event);
        }

        Ok(())
    }

    pub async fn reconnect(&self) -> Result<()> {
        let mut channel_lock = self.channel.write().await;
        match Self::connect().await {
            Ok(new_channel) => {
                *channel_lock = Some(new_channel);
                info!("Reconnected to RabbitMQ");
                Ok(())
            }
            Err(e) => {
                error!("Failed to reconnect to RabbitMQ: {}", e);
                Err(e)
            }
        }
    }
}
