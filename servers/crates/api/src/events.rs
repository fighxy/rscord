use lapin::{options::*, types::FieldTable, BasicProperties, Channel, Connection, ConnectionProperties};
use serde::Serialize;
use anyhow::Result;

#[derive(Clone)]
pub struct EventBus {
    pub channel: Option<Channel>,
}

impl EventBus {
    pub async fn connect(uri: &str) -> Result<Self> {
        let conn = Connection::connect(uri, ConnectionProperties::default()).await?;
        let channel = conn.create_channel().await?;
        channel.exchange_declare("radiate.events", lapin::ExchangeKind::Topic, ExchangeDeclareOptions { durable: true, ..Default::default() }, FieldTable::default()).await?;
        Ok(Self { channel: Some(channel) })
    }

    pub fn dummy() -> Self {
        let bus = Self { channel: None };
        tracing::warn!("EventBus created in dummy mode - events will not be published");
        bus
    }

    pub fn is_connected(&self) -> bool {
        self.channel.is_some()
    }

    pub async fn publish<T: Serialize>(&self, routing_key: &str, payload: &T) -> Result<()> {
        if let Some(channel) = &self.channel {
            let body = serde_json::to_vec(payload)?;
            channel
                .basic_publish(
                    "radiate.events",
                    routing_key,
                    BasicPublishOptions::default(),
                    &body,
                    BasicProperties::default(),
                )
                .await?
                .await?;
        }
        // If no channel (dummy mode), silently succeed
        Ok(())
    }
}


