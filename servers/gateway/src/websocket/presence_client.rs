use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::error::Error;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum UserStatus {
    Online,
    Idle,
    DoNotDisturb,
    Invisible,
    Offline,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdatePresenceRequest {
    pub status: UserStatus,
    pub activity: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PresenceResponse {
    pub user_id: String,
    pub status: UserStatus,
    pub activity: Option<String>,
    pub last_seen: chrono::DateTime<chrono::Utc>,
}

#[derive(Clone)]
pub struct PresenceServiceClient {
    client: Client,
    base_url: String,
}

impl PresenceServiceClient {
    pub fn new(base_url: String) -> Self {
        Self {
            client: Client::new(),
            base_url,
        }
    }

    pub async fn update_presence(
        &self,
        user_id: &str,
        status: UserStatus,
        activity: Option<String>,
        token: &str,
    ) -> Result<PresenceResponse, Box<dyn Error + Send + Sync>> {
        let url = format!("{}/presence/update/{}", self.base_url, user_id);
        
        let request = UpdatePresenceRequest { status, activity };
        
        let response = self.client
            .post(&url)
            .header("Authorization", format!("Bearer {}", token))
            .json(&request)
            .send()
            .await?;
        
        if !response.status().is_success() {
            return Err(format!("Failed to update presence: {}", response.status()).into());
        }
        
        let presence: PresenceResponse = response.json().await?;
        Ok(presence)
    }

    pub async fn get_presence(
        &self,
        user_id: &str,
    ) -> Result<PresenceResponse, Box<dyn Error + Send + Sync>> {
        let url = format!("{}/presence/{}", self.base_url, user_id);
        
        let response = self.client
            .get(&url)
            .send()
            .await?;
        
        if !response.status().is_success() {
            return Err(format!("Failed to get presence: {}", response.status()).into());
        }
        
        let presence: PresenceResponse = response.json().await?;
        Ok(presence)
    }

    pub async fn get_bulk_presence(
        &self,
        user_ids: Vec<String>,
    ) -> Result<Vec<PresenceResponse>, Box<dyn Error + Send + Sync>> {
        let url = format!("{}/presence/bulk", self.base_url);
        
        let response = self.client
            .post(&url)
            .json(&serde_json::json!({ "user_ids": user_ids }))
            .send()
            .await?;
        
        if !response.status().is_success() {
            return Err(format!("Failed to get bulk presence: {}", response.status()).into());
        }
        
        let presences: Vec<PresenceResponse> = response.json().await?;
        Ok(presences)
    }
}
