use bitflags::bitflags;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

bitflags! {
    #[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
    pub struct Permissions: u64 {
        // General permissions
        const VIEW_CHANNEL = 1 << 0;
        const MANAGE_CHANNELS = 1 << 1;
        const MANAGE_GUILD = 1 << 2;
        const KICK_MEMBERS = 1 << 3;
        const BAN_MEMBERS = 1 << 4;
        const CREATE_INSTANT_INVITE = 1 << 5;
        const CHANGE_NICKNAME = 1 << 6;
        const MANAGE_NICKNAMES = 1 << 7;
        const MANAGE_ROLES = 1 << 8;
        const MANAGE_WEBHOOKS = 1 << 9;
        const VIEW_AUDIT_LOG = 1 << 10;
        
        // Text permissions
        const SEND_MESSAGES = 1 << 11;
        const SEND_TTS_MESSAGES = 1 << 12;
        const MANAGE_MESSAGES = 1 << 13;
        const EMBED_LINKS = 1 << 14;
        const ATTACH_FILES = 1 << 15;
        const READ_MESSAGE_HISTORY = 1 << 16;
        const MENTION_EVERYONE = 1 << 17;
        const USE_EXTERNAL_EMOJIS = 1 << 18;
        const ADD_REACTIONS = 1 << 19;
        const USE_SLASH_COMMANDS = 1 << 20;
        const MANAGE_THREADS = 1 << 21;
        const CREATE_PUBLIC_THREADS = 1 << 22;
        const CREATE_PRIVATE_THREADS = 1 << 23;
        const SEND_MESSAGES_IN_THREADS = 1 << 24;
        
        // Voice permissions
        const CONNECT = 1 << 25;
        const SPEAK = 1 << 26;
        const MUTE_MEMBERS = 1 << 27;
        const DEAFEN_MEMBERS = 1 << 28;
        const MOVE_MEMBERS = 1 << 29;
        const USE_VAD = 1 << 30;
        const PRIORITY_SPEAKER = 1 << 31;
        const STREAM = 1 << 32;
        const USE_EMBEDDED_ACTIVITIES = 1 << 33;
        const USE_SOUNDBOARD = 1 << 34;
        const USE_EXTERNAL_SOUNDS = 1 << 35;
        
        // Advanced permissions
        const ADMINISTRATOR = 1 << 36;
        const MANAGE_EVENTS = 1 << 37;
        const MANAGE_EMOJIS = 1 << 38;
        const VIEW_GUILD_INSIGHTS = 1 << 39;
        const VIEW_CREATOR_MONETIZATION = 1 << 40;
        
        // Default permission sets
        const DEFAULT_MEMBER = Self::VIEW_CHANNEL.bits() 
            | Self::SEND_MESSAGES.bits()
            | Self::READ_MESSAGE_HISTORY.bits()
            | Self::ADD_REACTIONS.bits()
            | Self::CONNECT.bits()
            | Self::SPEAK.bits()
            | Self::USE_VAD.bits()
            | Self::CHANGE_NICKNAME.bits()
            | Self::CREATE_INSTANT_INVITE.bits()
            | Self::EMBED_LINKS.bits()
            | Self::ATTACH_FILES.bits()
            | Self::USE_EXTERNAL_EMOJIS.bits()
            | Self::USE_SLASH_COMMANDS.bits()
            | Self::CREATE_PUBLIC_THREADS.bits()
            | Self::SEND_MESSAGES_IN_THREADS.bits();
            
        const MODERATOR = Self::DEFAULT_MEMBER.bits()
            | Self::KICK_MEMBERS.bits()
            | Self::BAN_MEMBERS.bits()
            | Self::MANAGE_MESSAGES.bits()
            | Self::MANAGE_NICKNAMES.bits()
            | Self::MUTE_MEMBERS.bits()
            | Self::DEAFEN_MEMBERS.bits()
            | Self::MOVE_MEMBERS.bits()
            | Self::MANAGE_THREADS.bits()
            | Self::VIEW_AUDIT_LOG.bits();
            
        const ADMIN = Self::MODERATOR.bits()
            | Self::MANAGE_CHANNELS.bits()
            | Self::MANAGE_GUILD.bits()
            | Self::MANAGE_ROLES.bits()
            | Self::MANAGE_WEBHOOKS.bits()
            | Self::MANAGE_EMOJIS.bits()
            | Self::MANAGE_EVENTS.bits()
            | Self::VIEW_GUILD_INSIGHTS.bits();
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Role {
    pub id: String,
    pub name: String,
    pub color: Option<u32>,
    pub hoist: bool, // Display role members separately
    pub position: i32,
    pub permissions: Permissions,
    pub mentionable: bool,
    pub guild_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChannelPermissionOverwrite {
    pub id: String, // Role or User ID
    pub overwrite_type: OverwriteType,
    pub allow: Permissions,
    pub deny: Permissions,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum OverwriteType {
    Role,
    Member,
}

pub struct PermissionCalculator;

impl PermissionCalculator {
    /// Calculate final permissions for a user in a guild
    pub fn calculate_guild_permissions(
        user_id: &str,
        guild_owner_id: &str,
        member_roles: &[Role],
    ) -> Permissions {
        // Guild owner has all permissions
        if user_id == guild_owner_id {
            return Permissions::all();
        }
        
        // Start with @everyone role (if exists)
        let mut permissions = Permissions::empty();
        
        // Add permissions from all roles
        for role in member_roles {
            permissions |= role.permissions;
        }
        
        // Administrator permission overrides everything
        if permissions.contains(Permissions::ADMINISTRATOR) {
            return Permissions::all();
        }
        
        permissions
    }
    
    /// Calculate final permissions for a user in a channel
    pub fn calculate_channel_permissions(
        base_permissions: Permissions,
        channel_overwrites: &[ChannelPermissionOverwrite],
        member_roles: &[String],
        user_id: &str,
    ) -> Permissions {
        // Administrator bypasses all channel overwrites
        if base_permissions.contains(Permissions::ADMINISTRATOR) {
            return Permissions::all();
        }
        
        let mut permissions = base_permissions;
        
        // Apply @everyone overwrites first (if exists)
        for overwrite in channel_overwrites {
            if overwrite.overwrite_type == OverwriteType::Role {
                // Apply role overwrites
                if member_roles.contains(&overwrite.id) {
                    permissions &= !overwrite.deny;
                    permissions |= overwrite.allow;
                }
            }
        }
        
        // Apply member-specific overwrites (highest priority)
        for overwrite in channel_overwrites {
            if overwrite.overwrite_type == OverwriteType::Member && overwrite.id == user_id {
                permissions &= !overwrite.deny;
                permissions |= overwrite.allow;
                break;
            }
        }
        
        permissions
    }
    
    /// Check if user has specific permission
    pub fn has_permission(
        permissions: Permissions,
        required: Permissions,
    ) -> bool {
        permissions.contains(required) || permissions.contains(Permissions::ADMINISTRATOR)
    }
    
    /// Check multiple permissions at once
    pub fn has_any_permission(
        permissions: Permissions,
        required: &[Permissions],
    ) -> bool {
        if permissions.contains(Permissions::ADMINISTRATOR) {
            return true;
        }
        
        required.iter().any(|&p| permissions.contains(p))
    }
    
    /// Check if user can perform action on target
    pub fn can_moderate(
        actor_permissions: Permissions,
        actor_highest_role: i32,
        target_highest_role: i32,
        is_owner: bool,
    ) -> bool {
        // Owners can moderate anyone
        if is_owner {
            return true;
        }
        
        // Check if actor has moderation permissions
        if !actor_permissions.intersects(
            Permissions::KICK_MEMBERS | Permissions::BAN_MEMBERS | Permissions::MANAGE_ROLES
        ) {
            return false;
        }
        
        // Role hierarchy check - can only moderate lower roles
        actor_highest_role > target_highest_role
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PermissionCheck {
    pub user_id: String,
    pub guild_id: String,
    pub channel_id: Option<String>,
    pub required_permissions: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PermissionCheckResult {
    pub allowed: bool,
    pub missing_permissions: Vec<String>,
    pub user_permissions: u64,
}

impl Role {
    pub fn new(name: String, guild_id: String, permissions: Permissions) -> Self {
        Self {
            id: ulid::Ulid::new().to_string(),
            name,
            color: None,
            hoist: false,
            position: 0,
            permissions,
            mentionable: true,
            guild_id,
        }
    }
    
    pub fn create_everyone_role(guild_id: String) -> Self {
        Self::new("@everyone".to_string(), guild_id, Permissions::DEFAULT_MEMBER)
    }
    
    pub fn create_moderator_role(guild_id: String) -> Self {
        Self::new("Moderator".to_string(), guild_id, Permissions::MODERATOR)
    }
    
    pub fn create_admin_role(guild_id: String) -> Self {
        Self::new("Admin".to_string(), guild_id, Permissions::ADMIN)
    }
}

// Helper functions for permission checks in handlers
pub mod helpers {
    use super::*;
    
    pub fn can_send_message(permissions: Permissions) -> bool {
        permissions.contains(Permissions::SEND_MESSAGES) 
            || permissions.contains(Permissions::ADMINISTRATOR)
    }
    
    pub fn can_manage_messages(permissions: Permissions) -> bool {
        permissions.contains(Permissions::MANAGE_MESSAGES) 
            || permissions.contains(Permissions::ADMINISTRATOR)
    }
    
    pub fn can_manage_channel(permissions: Permissions) -> bool {
        permissions.contains(Permissions::MANAGE_CHANNELS) 
            || permissions.contains(Permissions::ADMINISTRATOR)
    }
    
    pub fn can_connect_voice(permissions: Permissions) -> bool {
        permissions.contains(Permissions::CONNECT) 
            || permissions.contains(Permissions::ADMINISTRATOR)
    }
    
    pub fn can_speak_voice(permissions: Permissions) -> bool {
        permissions.contains(Permissions::SPEAK) 
            || permissions.contains(Permissions::ADMINISTRATOR)
    }
    
    pub fn can_manage_guild(permissions: Permissions) -> bool {
        permissions.contains(Permissions::MANAGE_GUILD) 
            || permissions.contains(Permissions::ADMINISTRATOR)
    }
    
    pub fn can_manage_roles(permissions: Permissions) -> bool {
        permissions.contains(Permissions::MANAGE_ROLES) 
            || permissions.contains(Permissions::ADMINISTRATOR)
    }
    
    pub fn can_kick_members(permissions: Permissions) -> bool {
        permissions.contains(Permissions::KICK_MEMBERS) 
            || permissions.contains(Permissions::ADMINISTRATOR)
    }
    
    pub fn can_ban_members(permissions: Permissions) -> bool {
        permissions.contains(Permissions::BAN_MEMBERS) 
            || permissions.contains(Permissions::ADMINISTRATOR)
    }
}
