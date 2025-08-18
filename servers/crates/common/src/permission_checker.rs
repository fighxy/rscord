use crate::permissions::{Permissions, PermissionCalculator};
use crate::enhanced_jwt::{EnhancedJwtValidator, extract_user_from_headers};
use axum::http::{HeaderMap, StatusCode};
use mongodb::{bson::doc, Collection, Database};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tracing::{error, warn, debug};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserRole {
    #[serde(rename = "_id")]
    pub id: String,
    pub user_id: String,
    pub guild_id: String,
    pub role_id: String,
    pub assigned_at: chrono::DateTime<chrono::Utc>,
    pub assigned_by: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GuildRole {
    #[serde(rename = "_id")]
    pub id: String,
    pub guild_id: String,
    pub name: String,
    pub permissions: u64, // Bitfield of permissions
    pub color: Option<u32>,
    pub position: i32,
    pub mentionable: bool,
    pub hoist: bool,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChannelOverwrite {
    #[serde(rename = "_id")]
    pub id: String,
    pub channel_id: String,
    pub target_id: String, // role_id or user_id
    pub target_type: OverwriteType,
    pub allow: u64,
    pub deny: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum OverwriteType {
    Role,
    Member,
}

#[derive(Debug, Clone)]
pub struct PermissionChecker {
    jwt_validator: EnhancedJwtValidator,
    db: Database,
    guild_owner_cache: HashMap<String, String>, // guild_id -> owner_id
}

impl PermissionChecker {
    pub fn new(jwt_validator: EnhancedJwtValidator, db: Database) -> Self {
        Self {
            jwt_validator,
            db,
            guild_owner_cache: HashMap::new(),
        }
    }

    /// Check if user has specific permission in guild
    pub async fn check_guild_permission(
        &self,
        headers: &HeaderMap,
        guild_id: &str,
        required_permission: Permissions,
    ) -> Result<(String, Permissions), (StatusCode, String)> {
        let (user_id, _, _) = extract_user_from_headers(headers, &self.jwt_validator)?;
        
        let user_permissions = self.get_user_guild_permissions(&user_id, guild_id).await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Permission check failed: {}", e)))?;

        if !PermissionCalculator::has_permission(user_permissions, required_permission) {
            return Err((
                StatusCode::FORBIDDEN,
                format!("Missing required permission: {:?}", required_permission)
            ));
        }

        Ok((user_id, user_permissions))
    }

    /// Check if user has permission in specific channel
    pub async fn check_channel_permission(
        &self,
        headers: &HeaderMap,
        guild_id: &str,
        channel_id: &str,
        required_permission: Permissions,
    ) -> Result<(String, Permissions), (StatusCode, String)> {
        let (user_id, _, _) = extract_user_from_headers(headers, &self.jwt_validator)?;
        
        let user_permissions = self.get_user_channel_permissions(&user_id, guild_id, channel_id).await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Permission check failed: {}", e)))?;

        if !PermissionCalculator::has_permission(user_permissions, required_permission) {
            return Err((
                StatusCode::FORBIDDEN,
                format!("Missing required permission in channel: {:?}", required_permission)
            ));
        }

        Ok((user_id, user_permissions))
    }

    /// Check if user is guild owner
    pub async fn check_guild_owner(
        &self,
        headers: &HeaderMap,
        guild_id: &str,
    ) -> Result<String, (StatusCode, String)> {
        let (user_id, _, _) = extract_user_from_headers(headers, &self.jwt_validator)?;
        
        let owner_id = self.get_guild_owner(guild_id).await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to get guild owner: {}", e)))?;

        if user_id != owner_id {
            return Err((StatusCode::FORBIDDEN, "Only guild owner can perform this action".to_string()));
        }

        Ok(user_id)
    }

    /// Check if user can moderate another user
    pub async fn check_moderation_permission(
        &self,
        headers: &HeaderMap,
        guild_id: &str,
        target_user_id: &str,
        required_permission: Permissions,
    ) -> Result<String, (StatusCode, String)> {
        let (user_id, _, _) = extract_user_from_headers(headers, &self.jwt_validator)?;
        
        // Can't moderate yourself
        if user_id == target_user_id {
            return Err((StatusCode::BAD_REQUEST, "Cannot moderate yourself".to_string()));
        }

        let actor_permissions = self.get_user_guild_permissions(&user_id, guild_id).await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Permission check failed: {}", e)))?;

        // Check if actor has required permission
        if !PermissionCalculator::has_permission(actor_permissions, required_permission) {
            return Err((
                StatusCode::FORBIDDEN,
                format!("Missing required moderation permission: {:?}", required_permission)
            ));
        }

        // Get role hierarchy for both users
        let actor_highest_role = self.get_user_highest_role_position(&user_id, guild_id).await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to get role hierarchy: {}", e)))?;

        let target_highest_role = self.get_user_highest_role_position(target_user_id, guild_id).await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to get target role hierarchy: {}", e)))?;

        let is_owner = self.get_guild_owner(guild_id).await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to check ownership: {}", e)))?
            == user_id;

        // Check if user can moderate target based on role hierarchy
        if !PermissionCalculator::can_moderate(
            actor_permissions,
            actor_highest_role,
            target_highest_role,
            is_owner,
        ) {
            return Err((StatusCode::FORBIDDEN, "Cannot moderate user with equal or higher role".to_string()));
        }

        Ok(user_id)
    }

    /// Get user's guild permissions
    async fn get_user_guild_permissions(&self, user_id: &str, guild_id: &str) -> Result<Permissions, Box<dyn std::error::Error + Send + Sync>> {
        // Check if user is guild owner
        let owner_id = self.get_guild_owner(guild_id).await?;
        if user_id == owner_id {
            return Ok(Permissions::all());
        }

        // Get user's roles in guild
        let user_roles = self.get_user_roles(user_id, guild_id).await?;
        
        // Calculate combined permissions
        let permissions = PermissionCalculator::calculate_guild_permissions(user_id, &owner_id, &user_roles);
        
        debug!("User {} guild permissions in {}: {:?}", user_id, guild_id, permissions);
        Ok(permissions)
    }

    /// Get user's channel permissions (including overwrites)
    async fn get_user_channel_permissions(
        &self,
        user_id: &str,
        guild_id: &str,
        channel_id: &str,
    ) -> Result<Permissions, Box<dyn std::error::Error + Send + Sync>> {
        let base_permissions = self.get_user_guild_permissions(user_id, guild_id).await?;
        
        // Get channel overwrites
        let overwrites = self.get_channel_overwrites(channel_id).await?;
        
        // Get user's role IDs
        let user_roles = self.get_user_roles(user_id, guild_id).await?;
        let role_ids: Vec<String> = user_roles.iter().map(|r| r.id.clone()).collect();
        
        // Convert overwrites to permission format
        let channel_overwrites: Vec<crate::permissions::ChannelPermissionOverwrite> = overwrites
            .into_iter()
            .map(|o| crate::permissions::ChannelPermissionOverwrite {
                id: o.target_id,
                overwrite_type: match o.target_type {
                    OverwriteType::Role => crate::permissions::OverwriteType::Role,
                    OverwriteType::Member => crate::permissions::OverwriteType::Member,
                },
                allow: Permissions::from_bits_truncate(o.allow),
                deny: Permissions::from_bits_truncate(o.deny),
            })
            .collect();

        let final_permissions = PermissionCalculator::calculate_channel_permissions(
            base_permissions,
            &channel_overwrites,
            &role_ids,
            user_id,
        );
        
        debug!("User {} channel permissions in {}: {:?}", user_id, channel_id, final_permissions);
        Ok(final_permissions)
    }

    /// Get guild owner ID
    async fn get_guild_owner(&self, guild_id: &str) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
        // Check cache first
        if let Some(owner_id) = self.guild_owner_cache.get(guild_id) {
            return Ok(owner_id.clone());
        }

        // Query database
        let guilds: Collection<serde_json::Value> = self.db.collection("guilds");
        let guild = guilds
            .find_one(doc! { "_id": guild_id })
            .await?
            .ok_or("Guild not found")?;

        let owner_id = guild
            .get("owner_id")
            .and_then(|v| v.as_str())
            .ok_or("Guild owner not found")?
            .to_string();

        Ok(owner_id)
    }

    /// Get user's roles in guild
    async fn get_user_roles(&self, user_id: &str, guild_id: &str) -> Result<Vec<crate::permissions::Role>, Box<dyn std::error::Error + Send + Sync>> {
        let user_roles: Collection<UserRole> = self.db.collection("user_roles");
        let guild_roles: Collection<GuildRole> = self.db.collection("guild_roles");

        // Get user's role IDs
        let mut user_role_cursor = user_roles
            .find(doc! { "user_id": user_id, "guild_id": guild_id })
            .await?;

        let mut role_ids = Vec::new();
        while user_role_cursor.advance().await? {
            let user_role: UserRole = user_role_cursor.deserialize_current()?;
            role_ids.push(user_role.role_id);
        }

        // Get role details
        let mut roles = Vec::new();
        if !role_ids.is_empty() {
            let mut guild_role_cursor = guild_roles
                .find(doc! { "_id": { "$in": role_ids }, "guild_id": guild_id })
                .await?;

            while guild_role_cursor.advance().await? {
                let guild_role: GuildRole = guild_role_cursor.deserialize_current()?;
                roles.push(crate::permissions::Role {
                    id: guild_role.id,
                    name: guild_role.name,
                    color: guild_role.color,
                    hoist: guild_role.hoist,
                    position: guild_role.position,
                    permissions: Permissions::from_bits_truncate(guild_role.permissions),
                    mentionable: guild_role.mentionable,
                    guild_id: guild_role.guild_id,
                });
            }
        }

        // Add @everyone role if not present
        if !roles.iter().any(|r| r.name == "@everyone") {
            let everyone_role = crate::permissions::Role::create_everyone_role(guild_id.to_string());
            roles.push(everyone_role);
        }

        Ok(roles)
    }

    /// Get user's highest role position
    async fn get_user_highest_role_position(&self, user_id: &str, guild_id: &str) -> Result<i32, Box<dyn std::error::Error + Send + Sync>> {
        let roles = self.get_user_roles(user_id, guild_id).await?;
        Ok(roles.iter().map(|r| r.position).max().unwrap_or(0))
    }

    /// Get channel permission overwrites
    async fn get_channel_overwrites(&self, channel_id: &str) -> Result<Vec<ChannelOverwrite>, Box<dyn std::error::Error + Send + Sync>> {
        let overwrites: Collection<ChannelOverwrite> = self.db.collection("channel_overwrites");
        
        let mut cursor = overwrites
            .find(doc! { "channel_id": channel_id })
            .await?;

        let mut result = Vec::new();
        while cursor.advance().await? {
            let overwrite: ChannelOverwrite = cursor.deserialize_current()?;
            result.push(overwrite);
        }

        Ok(result)
    }
}

// Convenience macros for permission checking
#[macro_export]
macro_rules! require_guild_permission {
    ($checker:expr, $headers:expr, $guild_id:expr, $permission:expr) => {
        match $checker.check_guild_permission($headers, $guild_id, $permission).await {
            Ok((user_id, permissions)) => (user_id, permissions),
            Err((status, message)) => {
                return Err(status);
            }
        }
    };
}

#[macro_export]
macro_rules! require_channel_permission {
    ($checker:expr, $headers:expr, $guild_id:expr, $channel_id:expr, $permission:expr) => {
        match $checker.check_channel_permission($headers, $guild_id, $channel_id, $permission).await {
            Ok((user_id, permissions)) => (user_id, permissions),
            Err((status, message)) => {
                return Err(status);
            }
        }
    };
}

#[macro_export]
macro_rules! require_guild_owner {
    ($checker:expr, $headers:expr, $guild_id:expr) => {
        match $checker.check_guild_owner($headers, $guild_id).await {
            Ok(user_id) => user_id,
            Err((status, _)) => {
                return Err(status);
            }
        }
    };
}

pub use {require_guild_permission, require_channel_permission, require_guild_owner};
