use reqwest::Client;
use serde::{Deserialize, Serialize};
use tracing::{error, info};

#[derive(Serialize, Deserialize)]
pub struct CreateMessageRequest {
    pub channel_id: String,
    pub content: String,
    pub author_id: String,
}

#[derive(Serialize, Deserialize)]
pub struct MessageResponse {
    pub id: String,
    pub channel_id: String,
    pub content: String,
    pub author_id: String,
    pub author_username: String,
    pub timestamp: String,
}

#[derive(Clone)]
pub struct ChatServiceClient {
    client: Client,
    base_url: String,
}

impl ChatServiceClient {
    pub fn new(base_url: String) -> Self {
        Self {
            client: Client::new(),
            base_url,
        }
    }

    pub async fn create_message(
        &self,
        request: CreateMessageRequest,
        auth_token: &str,
    ) -> Result<MessageResponse, Box<dyn std::error::Error + Send + Sync>> {
        let url = format!("{}/api/messages", self.base_url);
        
        let response = self
            .client
            .post(&url)
            .header("Authorization", format!("Bearer {}", auth_token))
            .json(&request)
            .send()
            .await?;

        if response.status().is_success() {
            let message: MessageResponse = response.json().await?;
            info!("Message created successfully: {}", message.id);
            Ok(message)
        } else {
            let error_text = response.text().await?;
            error!("Failed to create message: {}", error_text);
            Err(format!("Chat service error: {}", error_text).into())
        }
    }

    pub async fn get_channel_messages(
        &self,
        channel_id: &str,
        auth_token: &str,
        limit: Option<u32>,
    ) -> Result<Vec<MessageResponse>, Box<dyn std::error::Error + Send + Sync>> {
        let mut url = format!("{}/api/channels/{}/messages", self.base_url, channel_id);
        
        if let Some(limit) = limit {
            url.push_str(&format!("?limit={}", limit));
        }
        
        let response = self
            .client
            .get(&url)
            .header("Authorization", format!("Bearer {}", auth_token))
            .send()
            .await?;

        if response.status().is_success() {
            let messages: Vec<MessageResponse> = response.json().await?;
            Ok(messages)
        } else {
            let error_text = response.text().await?;
            error!("Failed to get messages: {}", error_text);
            Err(format!("Chat service error: {}", error_text).into())
        }
    }
}
