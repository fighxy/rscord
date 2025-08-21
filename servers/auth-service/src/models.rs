use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone)]
pub struct UserDoc {
    #[serde(rename = "_id")]
    pub id: String,
    pub telegram_id: i64, // Обязательно для Telegram-only аутентификации
    pub telegram_username: Option<String>,
    pub username: String,
    pub display_name: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
}
