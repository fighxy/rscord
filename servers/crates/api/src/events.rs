use lapin::{options::*, types::FieldTable, BasicProperties, Channel, Connection, ConnectionProperties};
use serde::Serialize;
use anyhow::Result;

#[derive(Clone)]
pub struct EventBus {
    pub channel: Channel,
}

impl EventBus {
    pub async fn connect(uri: &str) -> Result<Self> {
        let conn = Connection::connect(uri, ConnectionProperties::default()).await?;
        let channel = conn.create_channel().await?;
        channel.exchange_declare("rscord.events", lapin::ExchangeKind::Topic, ExchangeDeclareOptions { durable: true, ..Default::default() }, FieldTable::default()).await?;
        Ok(Self { channel })
    }

    pub async fn publish<T: Serialize>(&self, routing_key: &str, payload: &T) -> Result<()> {
        let body = serde_json::to_vec(payload)?;
        self.channel
            .basic_publish(
                "rscord.events",
                routing_key,
                BasicPublishOptions::default(),
                &body,
                BasicProperties::default(),
            )
            .await?
            .await?;
        Ok(())
    }
}


