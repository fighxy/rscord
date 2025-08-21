use anyhow::Result;
use redis::AsyncCommands;

use crate::AuthRequest;

#[derive(Clone)]
pub struct RedisStore {
    client: redis::Client,
}

impl RedisStore {
    pub async fn new(redis_url: &str) -> Result<Self> {
        let client = redis::Client::open(redis_url)?;
        
        // Test connection
        let mut conn = client.get_multiplexed_async_connection().await?;
        let _: String = redis::cmd("PING").query_async(&mut conn).await?;

        Ok(Self { client })
    }

    pub async fn store_auth_request(&self, code: &str, auth_req: &AuthRequest) -> Result<()> {
        let mut conn = self.client.get_multiplexed_async_connection().await?;
        let key = format!("telegram_auth:{}", code);
        let value = serde_json::to_string(auth_req)?;
        
        // Store with 10 minute expiration
        conn.set_ex::<_, _, ()>(&key, value, 600).await?;
        
        Ok(())
    }

    pub async fn get_auth_request(&self, code: &str) -> Result<Option<AuthRequest>> {
        let mut conn = self.client.get_multiplexed_async_connection().await?;
        let key = format!("telegram_auth:{}", code);
        
        let value: Option<String> = conn.get(&key).await?;
        
        match value {
            Some(json) => {
                let auth_req: AuthRequest = serde_json::from_str(&json)?;
                Ok(Some(auth_req))
            }
            None => Ok(None),
        }
    }

    pub async fn delete_auth_request(&self, code: &str) -> Result<()> {
        let mut conn = self.client.get_multiplexed_async_connection().await?;
        let key = format!("telegram_auth:{}", code);
        
        conn.del::<_, ()>(&key).await?;
        
        Ok(())
    }
}