use mongodb::{
    bson::doc,
    options::{ClientOptions, IndexOptions},
    Client, Collection, IndexModel,
};
use serde::{Deserialize, Serialize};
use std::env;
use tracing::{info, warn, error};

#[derive(Debug, Serialize, Deserialize)]
struct OldUser {
    #[serde(rename = "_id")]
    id: String,
    telegram_id: Option<i64>,
    telegram_username: Option<String>,
    email: Option<String>,
    username: String,
    display_name: String,
    created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
struct NewUser {
    #[serde(rename = "_id")]
    id: String,
    telegram_id: i64, // Now required
    telegram_username: Option<String>,
    username: String,
    display_name: String,
    created_at: chrono::DateTime<chrono::Utc>,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    info!("🚀 Starting Radiate Migration");

    // Get MongoDB URI from environment
    let mongo_uri = env::var("MONGODB_URI")
        .unwrap_or_else(|_| "mongodb://localhost:27017".to_string());

    let client_options = ClientOptions::parse(&mongo_uri).await?;
    let client = Client::with_options(client_options)?;

    // Connect to databases
    let source_db = client.database("rscord");
    let target_db = client.database("radiate");
    
    info!("📂 Connected to MongoDB");

    // Migrate users with Telegram-only authentication
    migrate_users(&source_db, &target_db).await?;
    
    // Create indexes
    create_indexes(&target_db).await?;
    
    // Migrate other collections
    migrate_other_collections(&source_db, &target_db).await?;

    info!("✅ Migration completed successfully!");
    info!("💡 Original 'rscord' database preserved for backup");

    Ok(())
}

async fn migrate_users(
    source_db: &mongodb::Database,
    target_db: &mongodb::Database,
) -> Result<(), Box<dyn std::error::Error>> {
    info!("👥 Migrating users collection...");
    
    let source_users: Collection<OldUser> = source_db.collection("users");
    let target_users: Collection<NewUser> = target_db.collection("users");

    let mut cursor = source_users.find(doc! {}).await?;
    let mut migrated_count = 0;
    let mut skipped_count = 0;

    while cursor.advance().await? {
        let old_user = cursor.deserialize_current()?;
        
        if let Some(telegram_id) = old_user.telegram_id {
            let new_user = NewUser {
                id: old_user.id,
                telegram_id,
                telegram_username: old_user.telegram_username,
                username: old_user.username,
                display_name: old_user.display_name,
                created_at: old_user.created_at,
            };

            match target_users.insert_one(&new_user).await {
                Ok(_) => migrated_count += 1,
                Err(e) => {
                    warn!("Failed to migrate user {}: {}", new_user.username, e);
                }
            }
        } else {
            warn!("Skipping user {} - no telegram_id", old_user.username);
            skipped_count += 1;
        }
    }

    info!("✅ Users migration: {} migrated, {} skipped", migrated_count, skipped_count);
    Ok(())
}

async fn create_indexes(
    target_db: &mongodb::Database,
) -> Result<(), Box<dyn std::error::Error>> {
    info!("🔗 Creating database indexes...");
    
    let users: Collection<NewUser> = target_db.collection("users");
    
    // Unique index on telegram_id
    let telegram_index = IndexModel::builder()
        .keys(doc! {"telegram_id": 1})
        .options(IndexOptions::builder().unique(true).build())
        .build();
    
    users.create_index(telegram_index).await?;
    info!("✅ Created unique index on telegram_id");

    // Unique index on username  
    let username_index = IndexModel::builder()
        .keys(doc! {"username": 1})
        .options(IndexOptions::builder().unique(true).build())
        .build();
    
    users.create_index(username_index).await?;
    info!("✅ Created unique index on username");

    Ok(())
}

async fn migrate_other_collections(
    source_db: &mongodb::Database,
    target_db: &mongodb::Database,
) -> Result<(), Box<dyn std::error::Error>> {
    let collections = ["messages", "channels", "guilds", "voice_sessions"];
    
    for collection_name in collections {
        info!("📋 Migrating collection: {}", collection_name);
        
        let source_collection = source_db.collection::<mongodb::bson::Document>(collection_name);
        let target_collection = target_db.collection::<mongodb::bson::Document>(collection_name);
        
        let count = source_collection.count_documents(doc! {}).await?;
        
        if count > 0 {
            let mut cursor = source_collection.find(doc! {}).await?;
            let mut documents = Vec::new();
            
            while cursor.advance().await? {
                documents.push(cursor.deserialize_current()?);
            }
            
            if !documents.is_empty() {
                target_collection.insert_many(&documents).await?;
                info!("✅ Migrated {} documents in {}", documents.len(), collection_name);
            }
        } else {
            info!("⚠️  Collection {} is empty", collection_name);
        }
    }
    
    Ok(())
}