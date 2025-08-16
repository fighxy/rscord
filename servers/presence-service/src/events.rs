// This module handles event publishing for presence updates
// Similar to the chat service, but focused on presence events

use anyhow::Result;
use lapin::{
    options::*, types::FieldTable, BasicProperties, Connection,
    ConnectionProperties, Channel,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{error, info};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PresenceEvent {
    StatusChanged {
        user_id: String,
        old_status: String,
        new_status: String,
        guild_id: Option<String>,
    },
    ActivityChanged {
        user_id: String,
        activity: Option<String>,
        guild_id: Option<String>,
    },
    UserOnline {
        user_id: String,
        guild_id: Option<String>,
    },
    UserOffline {
        user_id: String,
        guild_id: Option<String>,
    },
}

pub struct PresenceEventPublisher {
    channel: Arc<RwLock<Option<Channel>>>,
}

impl PresenceEventPublisher {
    pub async fn new() -> Result<Self> {
        let channel = match Self::connect().await {
            Ok(ch) => Some(ch),
            Err(e) => {
                error!("Failed to connect to RabbitMQ: {}. Presence events will not be published.", e);
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

        // Declare exchange for presence events
        channel
            .exchange_declare(
                "presence_events",
                lapin::ExchangeKind::Topic,
                ExchangeDeclareOptions {
                    durable: true,
                    auto_delete: false,
                    internal: false,
                    nowait: false,
                    passive: false,
                },
                FieldTable::default(),
            )
            .await?;

        info!("Connected to RabbitMQ and declared presence_events exchange");
        Ok(channel)
    }

    pub async fn publish_event(&self, event: PresenceEvent) -> Result<()> {
        let channel_lock = self.channel.read().await;
        if let Some(ref channel) = *channel_lock {
            let routing_key = match &event {
                PresenceEvent::StatusChanged { .. } => "presence.status.changed",
                PresenceEvent::ActivityChanged { .. } => "presence.activity.changed",
                PresenceEvent::UserOnline { .. } => "presence.user.online",
                PresenceEvent::UserOffline { .. } => "presence.user.offline",
            };

            let payload = serde_json::to_vec(&event)?;

            let _confirmation = channel
                .basic_publish(
                    "presence_events",
                    routing_key,
                    BasicPublishOptions::default(),
                    &payload,
                    BasicProperties::default(),
                )
                .await?
                .await?;

            info!("Published presence event: {} to routing key: {}", serde_json::to_string(&event)?, routing_key);
        } else {
            info!("Presence event not published (RabbitMQ unavailable): {:?}", event);
        }

        Ok(())
    }
}
