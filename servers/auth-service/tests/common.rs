use axum::Router;
use axum_test::TestServer;
use mongodb::{options::ClientOptions, Client as MongoClient};
use rscord_common::AppConfig;
use serde_json::{json, Value};
use std::sync::Arc;
use tempfile::tempdir;
use uuid::Uuid;

/// Create a test app with in-memory or test database
pub async fn create_test_app() -> Router {
    // Create a test configuration
    let test_config = create_test_config().await;
    
    // Connect to test MongoDB (or use embedded MongoDB for tests)
    let mongo_uri = test_config.mongodb_uri.clone().unwrap_or_else(|| {
        // Use MongoDB test instance or embedded MongoDB
        format!("mongodb://localhost:27017/rscord_test_{}", Uuid::new_v4())
    });
    
    let mongo = MongoClient::with_uri_str(mongo_uri)
        .await
        .expect("Failed to connect to test MongoDB");

    let state = super::super::src::main::AuthState {
        mongo: mongo.clone(),
        jwt_secret: test_config.jwt_secret.clone().expect("JWT secret not configured"),
    };

    // Note: This won't work directly as main.rs is not a library
    // We'll need to refactor the main.rs to expose the app creation function
    // For now, this is a placeholder structure
    
    Router::new()
        // Add test routes here
}

/// Create test configuration
pub async fn create_test_config() -> AppConfig {
    AppConfig {
        mongodb_uri: Some("mongodb://localhost:27017".to_string()),
        jwt_secret: Some("test_jwt_secret_key".to_string()),
        ..Default::default()
    }
}

/// Helper function to create a test user and return token
pub async fn create_test_user(server: &TestServer) -> (String, Value) {
    let user_data = json!({
        "email": "test@example.com",
        "display_name": "Test User",
        "password": "password123"
    });

    let register_response = server
        .post("/auth/register")
        .json(&user_data)
        .await;

    let register_body: Value = register_response.json();
    let user = register_body["user"].clone();

    let login_data = json!({
        "email": "test@example.com",
        "password": "password123"
    });

    let login_response = server
        .post("/auth/login")
        .json(&login_data)
        .await;

    let login_body: Value = login_response.json();
    let token = login_body["token"].as_str().unwrap().to_string();

    (token, user)
}

/// Clean up test database
pub async fn cleanup_test_db(mongo: &MongoClient, db_name: &str) {
    let _ = mongo.database(db_name).drop().await;
}

/// Create a test JWT token for testing
pub fn create_test_jwt_token(user_id: &str, secret: &str) -> String {
    use jsonwebtoken::{encode, Header, EncodingKey};
    use serde::{Serialize, Deserialize};
    use chrono::Utc;

    #[derive(Debug, Serialize, Deserialize)]
    struct Claims {
        sub: String,
        exp: i64,
        iat: i64,
    }

    let now = Utc::now();
    let exp = now + chrono::Duration::hours(1);
    
    let claims = Claims {
        sub: user_id.to_string(),
        exp: exp.timestamp(),
        iat: now.timestamp(),
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_ref()),
    ).expect("Failed to create test JWT token")
}
