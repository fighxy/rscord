use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
    Extension,
};
use serde::{Deserialize, Serialize};

use crate::models::{Message, Reaction, Attachment};
use crate::ChatState;

#[derive(Debug, Deserialize)]
pub struct AddReactionRequest {
    pub emoji: String,
}

#[derive(Debug, Serialize)]
pub struct ReactionResponse {
    pub message_id: String,
    pub emoji: String,
    pub count: u32,
    pub users: Vec<String>,
}

pub async fn add_reaction(
    State(state): State<ChatState>,
    Path((channel_id, message_id)): Path<(String, String)>,
    Extension(user_id): Extension<String>,
    Json(request): Json<AddReactionRequest>,
) -> Result<Json<ReactionResponse>, StatusCode> {
    // Get the message from database
    let messages = state.db.collection::<Message>("messages");
    
    let filter = mongodb::bson::doc! {
        "_id": &message_id,
        "channel_id": &channel_id,
    };
    
    let mut message = messages
        .find_one(filter.clone())
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;
    
    // Find or create reaction
    let reaction_index = message.reactions.iter().position(|r| r.emoji == request.emoji);
    
    if let Some(index) = reaction_index {
        // Add user to existing reaction
        if !message.reactions[index].users.contains(&user_id) {
            message.reactions[index].users.push(user_id.clone());
            message.reactions[index].count += 1;
        }
    } else {
        // Create new reaction
        message.reactions.push(Reaction {
            emoji: request.emoji.clone(),
            count: 1,
            users: vec![user_id.clone()],
        });
    }
    
    // Update message in database
    let update = mongodb::bson::doc! {
        "$set": {
            "reactions": mongodb::bson::to_bson(&message.reactions).unwrap(),
        }
    };
    
    messages
        .update_one(filter, update)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    // Find the updated reaction
    let reaction = message.reactions
        .iter()
        .find(|r| r.emoji == request.emoji)
        .ok_or(StatusCode::INTERNAL_SERVER_ERROR)?;
    
    Ok(Json(ReactionResponse {
        message_id,
        emoji: reaction.emoji.clone(),
        count: reaction.count,
        users: reaction.users.clone(),
    }))
}

pub async fn remove_reaction(
    State(state): State<ChatState>,
    Path((channel_id, message_id, emoji)): Path<(String, String, String)>,
    Extension(user_id): Extension<String>,
) -> Result<StatusCode, StatusCode> {
    let messages = state.db.collection::<Message>("messages");
    
    let filter = mongodb::bson::doc! {
        "_id": &message_id,
        "channel_id": &channel_id,
    };
    
    let mut message = messages
        .find_one(filter.clone())
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;
    
    // Find and update reaction
    if let Some(reaction) = message.reactions.iter_mut().find(|r| r.emoji == emoji) {
        reaction.users.retain(|u| u != &user_id);
        reaction.count = reaction.users.len() as u32;
    }
    
    // Remove empty reactions
    message.reactions.retain(|r| r.count > 0);
    
    // Update message in database
    let update = mongodb::bson::doc! {
        "$set": {
            "reactions": mongodb::bson::to_bson(&message.reactions).unwrap(),
        }
    };
    
    messages
        .update_one(filter, update)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Debug, Deserialize)]
pub struct AddAttachmentRequest {
    pub filename: String,
    pub content_type: Option<String>,
    pub size: u64,
    pub url: String,
}

pub async fn add_attachment(
    State(state): State<ChatState>,
    Path((channel_id, message_id)): Path<(String, String)>,
    Json(request): Json<AddAttachmentRequest>,
) -> Result<Json<Attachment>, StatusCode> {
    let messages = state.db.collection::<Message>("messages");
    
    let filter = mongodb::bson::doc! {
        "_id": &message_id,
        "channel_id": &channel_id,
    };
    
    let attachment = Attachment {
        id: ulid::Ulid::new().to_string(),
        filename: request.filename,
        content_type: request.content_type,
        size: request.size,
        url: request.url,
    };
    
    let update = mongodb::bson::doc! {
        "$push": {
            "attachments": mongodb::bson::to_bson(&attachment).unwrap(),
        }
    };
    
    messages
        .update_one(filter, update)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    Ok(Json(attachment))
}

pub async fn get_reactions(
    State(state): State<ChatState>,
    Path((channel_id, message_id)): Path<(String, String)>,
) -> Result<Json<Vec<Reaction>>, StatusCode> {
    let messages = state.db.collection::<Message>("messages");
    
    let filter = mongodb::bson::doc! {
        "_id": &message_id,
        "channel_id": &channel_id,
    };
    
    let message = messages
        .find_one(filter)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;
    
    Ok(Json(message.reactions))
}

#[derive(Debug, Deserialize)]
pub struct EditMessageRequest {
    pub content: String,
}

pub async fn edit_message(
    State(state): State<ChatState>,
    Path((channel_id, message_id)): Path<(String, String)>,
    Extension(user_id): Extension<String>,
    Json(request): Json<EditMessageRequest>,
) -> Result<Json<Message>, StatusCode> {
    let messages = state.db.collection::<Message>("messages");
    
    let filter = mongodb::bson::doc! {
        "_id": &message_id,
        "channel_id": &channel_id,
        "author_id": &user_id, // Only author can edit
    };
    
    let update = mongodb::bson::doc! {
        "$set": {
            "content": &request.content,
            "edited_at": mongodb::bson::DateTime::now(),
        }
    };
    
    messages
        .update_one(filter.clone(), update)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    let updated_message = messages
        .find_one(filter)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;
    
    Ok(Json(updated_message))
}

pub async fn delete_message(
    State(state): State<ChatState>,
    Path((channel_id, message_id)): Path<(String, String)>,
    Extension(user_id): Extension<String>,
) -> Result<StatusCode, StatusCode> {
    let messages = state.db.collection::<Message>("messages");
    
    // TODO: Add permission check - for now only author can delete
    let filter = mongodb::bson::doc! {
        "_id": &message_id,
        "channel_id": &channel_id,
        "author_id": &user_id,
    };
    
    let result = messages
        .delete_one(filter)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    if result.deleted_count == 0 {
        return Err(StatusCode::NOT_FOUND);
    }
    
    Ok(StatusCode::NO_CONTENT)
}
