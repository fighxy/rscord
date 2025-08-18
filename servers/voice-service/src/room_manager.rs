        
        // Update room in database
        let rooms_collection: Collection<VoiceRoom> = self.db.collection("voice_rooms");
        rooms_collection.update_one(
            doc! { "_id": room_id },
            doc! { "$addToSet": { "current_participants": user_id } }
        ).await?;

        // Update active rooms cache
        self.active_rooms.insert(room_id.to_string(), room_clone);

        // Update user sessions cache
        self.user_sessions.insert(user_id.to_string(), session.clone());

        info!("User {} joined voice room {}", username, room_id);
        Ok(session)
    }

    /// Leave a voice room
    pub async fn leave_voice_room(
        &self,
        room_id: &str,
        user_id: &str,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // Get current session
        let mut session = self.user_sessions.get_mut(user_id)
            .ok_or("User not in any voice room")?;

        // Update session end time
        session.left_at = Some(chrono::Utc::now());

        // Update session in database
        let sessions_collection: Collection<VoiceSession> = self.db.collection("voice_sessions");
        sessions_collection.update_one(
            doc! { "_id": &session.id },
            doc! { "$set": { "left_at": chrono::Utc::now() } }
        ).await?;

        // Remove from room participants
        let rooms_collection: Collection<VoiceRoom> = self.db.collection("voice_rooms");
        rooms_collection.update_one(
            doc! { "_id": room_id },
            doc! { "$pull": { "current_participants": user_id } }
        ).await?;

        // Update active rooms cache
        if let Some(mut room) = self.active_rooms.get_mut(room_id) {
            room.current_participants.retain(|id| id != user_id);
            
            // If room is empty, deactivate it
            if room.current_participants.is_empty() {
                room.is_active = false;
                
                // Delete from LiveKit after a delay (in case someone rejoins quickly)
                let livekit_client = self.livekit_client.clone();
                let livekit_room_name = room.livekit_room_name.clone();
                tokio::spawn(async move {
                    tokio::time::sleep(tokio::time::Duration::from_secs(30)).await;
                    let _ = livekit_client.delete_voice_room(&livekit_room_name).await;
                });
            }
        }

        // Remove user session
        self.user_sessions.remove(user_id);

        info!("User {} left voice room {}", user_id, room_id);
        Ok(())
    }

    /// Get room information
    pub async fn get_room(&self, room_id: &str) -> Result<Option<VoiceRoom>, Box<dyn std::error::Error + Send + Sync>> {
        // Try cache first
        if let Some(room) = self.active_rooms.get(room_id) {
            return Ok(Some(room.clone()));
        }

        // Fallback to database
        let rooms_collection: Collection<VoiceRoom> = self.db.collection("voice_rooms");
        let room = rooms_collection
            .find_one(doc! { "_id": room_id })
            .await?;

        if let Some(room) = &room {
            // Add to cache if active
            if room.is_active {
                self.active_rooms.insert(room_id.to_string(), room.clone());
            }
        }

        Ok(room)
    }

    /// Get all rooms in a guild
    pub async fn get_guild_rooms(&self, guild_id: &str) -> Result<Vec<VoiceRoom>, Box<dyn std::error::Error + Send + Sync>> {
        let rooms_collection: Collection<VoiceRoom> = self.db.collection("voice_rooms");
        let mut cursor = rooms_collection
            .find(doc! { "guild_id": guild_id, "is_active": true })
            .await?;

        let mut rooms = Vec::new();
        while cursor.advance().await? {
            rooms.push(cursor.deserialize_current()?);
        }

        Ok(rooms)
    }

    /// Get user's current voice session
    pub fn get_user_session(&self, user_id: &str) -> Option<VoiceSession> {
        self.user_sessions.get(user_id).map(|s| s.clone())
    }

    /// Get all participants in a room
    pub async fn get_room_participants(&self, room_id: &str) -> Result<Vec<VoiceSession>, Box<dyn std::error::Error + Send + Sync>> {
        let sessions_collection: Collection<VoiceSession> = self.db.collection("voice_sessions");
        let mut cursor = sessions_collection
            .find(doc! { "room_id": room_id, "left_at": { "$exists": false } })
            .await?;

        let mut participants = Vec::new();
        while cursor.advance().await? {
            participants.push(cursor.deserialize_current()?);
        }

        Ok(participants)
    }

    /// Set participant mute status
    pub async fn set_participant_mute(
        &self,
        room_id: &str,
        user_id: &str,
        muted: bool,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // Get room and session
        let room = self.get_room(room_id).await?
            .ok_or("Room not found")?;
        
        let mut session = self.user_sessions.get_mut(user_id)
            .ok_or("User not in voice room")?;

        // Update mute status in LiveKit
        self.livekit_client
            .set_participant_mute(&room.livekit_room_name, user_id, muted)
            .await?;

        // Update session
        session.is_muted = muted;

        // Update in database
        let sessions_collection: Collection<VoiceSession> = self.db.collection("voice_sessions");
        sessions_collection.update_one(
            doc! { "_id": &session.id },
            doc! { "$set": { "is_muted": muted } }
        ).await?;

        info!("Set user {} mute status to {} in room {}", user_id, muted, room_id);
        Ok(())
    }

    /// Remove participant from room (admin action)
    pub async fn remove_participant(
        &self,
        room_id: &str,
        user_id: &str,
        admin_user_id: &str,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // TODO: Check admin permissions
        
        let room = self.get_room(room_id).await?
            .ok_or("Room not found")?;

        // Remove from LiveKit
        self.livekit_client
            .remove_participant(&room.livekit_room_name, user_id)
            .await?;

        // This will trigger the leave logic through webhooks
        self.leave_voice_room(room_id, user_id).await?;

        info!("Admin {} removed user {} from room {}", admin_user_id, user_id, room_id);
        Ok(())
    }

    /// Delete a voice room (admin action)
    pub async fn delete_voice_room(
        &self,
        room_id: &str,
        admin_user_id: &str,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let room = self.get_room(room_id).await?
            .ok_or("Room not found")?;

        // Check if user can delete (room creator or admin)
        // TODO: Implement proper permission checking

        // Remove all participants first
        for participant_id in &room.current_participants {
            let _ = self.leave_voice_room(room_id, participant_id).await;
        }

        // Delete from LiveKit
        self.livekit_client
            .delete_voice_room(&room.livekit_room_name)
            .await?;

        // Mark as inactive in database
        let rooms_collection: Collection<VoiceRoom> = self.db.collection("voice_rooms");
        rooms_collection.update_one(
            doc! { "_id": room_id },
            doc! { "$set": { "is_active": false } }
        ).await?;

        // Remove from cache
        self.active_rooms.remove(room_id);

        info!("Admin {} deleted voice room {}", admin_user_id, room_id);
        Ok(())
    }

    /// Cleanup inactive rooms (called periodically)
    pub async fn cleanup_inactive_rooms(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let rooms_collection: Collection<VoiceRoom> = self.db.collection("voice_rooms");
        let cutoff_time = chrono::Utc::now() - chrono::Duration::hours(1);

        // Find rooms that have been empty for more than 1 hour
        let mut cursor = rooms_collection
            .find(doc! {
                "is_active": true,
                "current_participants": { "$size": 0 },
                "created_at": { "$lt": cutoff_time }
            })
            .await?;

        while cursor.advance().await? {
            let room: VoiceRoom = cursor.deserialize_current()?;
            
            // Delete from LiveKit
            let _ = self.livekit_client
                .delete_voice_room(&room.livekit_room_name)
                .await;

            // Mark as inactive
            rooms_collection.update_one(
                doc! { "_id": &room.id },
                doc! { "$set": { "is_active": false } }
            ).await?;

            // Remove from cache
            self.active_rooms.remove(&room.id);

            info!("Cleaned up inactive room: {}", room.id);
        }

        Ok(())
    }

    /// Get voice room statistics
    pub async fn get_room_stats(&self, room_id: &str) -> Result<RoomStats, Box<dyn std::error::Error + Send + Sync>> {
        let room = self.get_room(room_id).await?
            .ok_or("Room not found")?;

        let participants = self.get_room_participants(room_id).await?;
        let total_duration = participants.iter()
            .map(|p| chrono::Utc::now().signed_duration_since(p.joined_at).num_seconds())
            .sum::<i64>();

        Ok(RoomStats {
            room_id: room_id.to_string(),
            current_participants: participants.len(),
            max_participants: room.max_participants,
            total_duration_seconds: total_duration,
            created_at: room.created_at,
        })
    }
}

#[derive(Debug, Serialize)]
pub struct RoomStats {
    pub room_id: String,
    pub current_participants: usize,
    pub max_participants: u32,
    pub total_duration_seconds: i64,
    pub created_at: chrono::DateTime<chrono::Utc>,
}
