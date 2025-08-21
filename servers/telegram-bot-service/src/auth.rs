use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TelegramUser {
    pub id: i64,
    pub username: Option<String>,
    pub first_name: String,
    pub last_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthSession {
    pub code: String,
    pub user: Option<TelegramUser>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub expires_at: chrono::DateTime<chrono::Utc>,
    pub confirmed: bool,
}

impl AuthSession {
    pub fn new(code: String) -> Self {
        let now = chrono::Utc::now();
        Self {
            code,
            user: None,
            created_at: now,
            expires_at: now + chrono::Duration::minutes(10),
            confirmed: false,
        }
    }

    pub fn is_expired(&self) -> bool {
        chrono::Utc::now() > self.expires_at
    }

    pub fn confirm_with_user(&mut self, user: TelegramUser) {
        self.user = Some(user);
        self.confirmed = true;
    }
}