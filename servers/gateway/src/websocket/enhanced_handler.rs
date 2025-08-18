    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // Rate limiting check
        if !manager.redis.check_rate_limit(user_id, "send_message", 10, 60).await? {
            if let Some(conn) = manager.connections.get(user_id) {
                let error_msg = WsMessage::Error {
                    message: "Rate limit exceeded. Please slow down.".to_string(),
                    code: Some("RATE_LIMITED".to_string()),
                };
                let _ = conn.sender.send(serde_json::to_string(&error_msg)?);
            }
            return Ok(());
        }
        
        // Save message to database via chat-service
        let create_request = CreateMessageRequest {
            channel_id: channel_id.to_string(),
            content: content.to_string(),
            author_id: user_id.to_string(),
        };
        
        match chat_client.create_message(create_request, token).await {
            Ok(saved_message) => {
                // Broadcast message via Redis PubSub
                let redis_msg = RedisMessage::MessageCreate {
                    channel_id: channel_id.to_string(),
                    message_id: saved_message.id.clone(),
                    author_id: user_id.to_string(),
                    author_name: saved_message.author_username.clone(),
                    content: saved_message.content.clone(),
                    timestamp: chrono::Utc::now().timestamp(),
                };
                
                // Cache message in Redis for quick access
                let _ = manager.redis.cache_message(
                    &saved_message.id,
                    &serde_json::to_string(&saved_message)?,
                    3600, // 1 hour cache
                ).await;
                
                // Broadcast to channel subscribers
                manager.redis.broadcast_to_channel(channel_id, &redis_msg).await?;
                
                // Send acknowledgment with nonce back to sender
                if let Some(nonce_val) = nonce {
                    if let Some(conn) = manager.connections.get(user_id) {
                        let ack_msg = WsMessage::MessageCreated {
                            channel_id: channel_id.to_string(),
                            message_id: saved_message.id,
                            user_id: user_id.to_string(),
                            username: saved_message.author_username,
                            content: saved_message.content,
                            timestamp: chrono::Utc::now().timestamp(),
                            nonce: Some(nonce_val),
                        };
                        let _ = conn.sender.send(serde_json::to_string(&ack_msg)?);
                    }
                }
            }
            Err(e) => {
                error!("Failed to save message: {}", e);
                if let Some(conn) = manager.connections.get(user_id) {
                    let error_msg = WsMessage::Error {
                        message: "Failed to send message".to_string(),
                        code: Some("MESSAGE_SEND_FAILED".to_string()),
                    };
                    let _ = conn.sender.send(serde_json::to_string(&error_msg)?);
                }
            }
        }
        
        Ok(())
    }
    
    async fn handle_edit_message(
        user_id: &str,
        channel_id: &str,
        message_id: &str,
        content: &str,
        manager: &SharedState,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // TODO: Verify user owns the message via chat-service
        
        let redis_msg = RedisMessage::MessageUpdate {
            channel_id: channel_id.to_string(),
            message_id: message_id.to_string(),
            content: content.to_string(),
            edited_at: chrono::Utc::now().timestamp(),
        };
        
        manager.redis.broadcast_to_channel(channel_id, &redis_msg).await?;
        
        Ok(())
    }
    
    async fn handle_delete_message(
        user_id: &str,
        channel_id: &str,
        message_id: &str,
        manager: &SharedState,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // TODO: Verify user owns the message or has permission via chat-service
        
        let redis_msg = RedisMessage::MessageDelete {
            channel_id: channel_id.to_string(),
            message_id: message_id.to_string(),
        };
        
        manager.redis.broadcast_to_channel(channel_id, &redis_msg).await?;
        
        Ok(())
    }
    
    async fn handle_typing_indicator(
        user_id: &str,
        channel_id: &str,
        is_typing: bool,
        manager: &SharedState,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let username = manager.connections.get(user_id)
            .map(|c| c.username.clone())
            .unwrap_or_default();
        
        let redis_msg = if is_typing {
            RedisMessage::TypingStart {
                channel_id: channel_id.to_string(),
                user_id: user_id.to_string(),
                username,
            }
        } else {
            RedisMessage::TypingStop {
                channel_id: channel_id.to_string(),
                user_id: user_id.to_string(),
            }
        };
        
        manager.redis.broadcast_to_channel(channel_id, &redis_msg).await?;
        
        Ok(())
    }
    
    async fn cleanup_connection(&self, user_id: &str) {
        info!("Cleaning up connection for user: {}", user_id);
        
        // Update presence to Offline
        let _ = self.presence_client.update_presence(
            user_id,
            UserStatus::Offline,
            None,
            "",
        ).await;
        
        // Remove from Redis session
        let _ = self.connection_manager.redis.delete_user_session(user_id).await;
        
        if let Some((_, conn_info)) = self.connection_manager.connections.remove(user_id) {
            // Unsubscribe from all channels
            for channel_id in &conn_info.current_channels {
                let redis_msg = RedisMessage::UserLeaveChannel {
                    channel_id: channel_id.clone(),
                    user_id: user_id.to_string(),
                };
                let _ = self.connection_manager.redis.broadcast_to_channel(channel_id, &redis_msg).await;
            }
            
            // Remove from channel subscriptions
            for channel_id in &conn_info.current_channels {
                if let Some(mut subs) = self.connection_manager.channel_subscriptions.get_mut(channel_id) {
                    subs.retain(|u| u != user_id);
                }
            }
        }
        
        // Unsubscribe from user's personal Redis channel
        let user_channel = format!("user:{}", user_id);
        let _ = self.connection_manager.redis.unsubscribe_channels(vec![user_channel]).await;
    }
}
