use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum UserStatus {
    Online,
    Idle,
    DoNotDisturb,
    Invisible,
    Offline,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserPresence {
    pub user_id: String,
    pub status: UserStatus,
    pub custom_status: Option<String>,
    pub last_seen: DateTime<Utc>,
    pub activities: Vec<Activity>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Activity {
    pub name: String,
    pub activity_type: ActivityType,
    pub details: Option<String>,
    pub state: Option<String>,
    pub started_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ActivityType {
    Playing,
    Streaming,
    Listening,
    Watching,
    Custom,
    Competing,
}

pub struct PresenceManager {
    presences: Arc<RwLock<HashMap<String, UserPresence>>>,
}

impl PresenceManager {
    pub fn new() -> Self {
        Self {
            presences: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn update_presence(&self, user_id: String, status: UserStatus) -> UserPresence {
        let mut presences = self.presences.write().await;
        let presence = presences.entry(user_id.clone()).or_insert_with(|| {
            UserPresence {
                user_id: user_id.clone(),
                status: UserStatus::Offline,
                custom_status: None,
                last_seen: Utc::now(),
                activities: Vec::new(),
            }
        });
        
        presence.status = status;
        presence.last_seen = Utc::now();
        presence.clone()
    }

    pub async fn set_activity(&self, user_id: String, activity: Activity) {
        let mut presences = self.presences.write().await;
        if let Some(presence) = presences.get_mut(&user_id) {
            presence.activities.clear();
            presence.activities.push(activity);
            presence.last_seen = Utc::now();
        }
    }

    pub async fn get_presence(&self, user_id: &str) -> Option<UserPresence> {
        let presences = self.presences.read().await;
        presences.get(user_id).cloned()
    }

    pub async fn get_online_users(&self) -> Vec<String> {
        let presences = self.presences.read().await;
        presences
            .iter()
            .filter(|(_, p)| !matches!(p.status, UserStatus::Offline | UserStatus::Invisible))
            .map(|(id, _)| id.clone())
            .collect()
    }

    pub async fn set_offline(&self, user_id: &str) {
        let mut presences = self.presences.write().await;
        if let Some(presence) = presences.get_mut(user_id) {
            presence.status = UserStatus::Offline;
            presence.last_seen = Utc::now();
        }
    }

    pub async fn cleanup_stale_presences(&self, timeout_minutes: i64) {
        let mut presences = self.presences.write().await;
        let cutoff = Utc::now() - chrono::Duration::minutes(timeout_minutes);
        
        presences.retain(|_, p| {
            p.last_seen > cutoff || !matches!(p.status, UserStatus::Offline)
        });
    }
}
