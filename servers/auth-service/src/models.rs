use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone)]
pub struct UserDoc {
    #[serde(rename = "_id")]
    pub id: String,
    pub telegram_id: Option<i64>,
    pub telegram_username: Option<String>,
    pub email: Option<String>, // Опциональное для совместимости
    pub username: String,
    pub display_name: String,
    pub password_hash: Option<String>, // Опциональное для Telegram users
    pub created_at: chrono::DateTime<chrono::Utc>,
}
