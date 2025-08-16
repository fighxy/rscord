use axum::http::StatusCode;
use axum_test::TestServer;
use serde_json::json;
use tokio;

mod common;

#[tokio::test]
async fn test_health_endpoint() {
    let app = common::create_test_app().await;
    let server = TestServer::new(app).unwrap();

    let response = server.get("/health").await;
    
    assert_eq!(response.status_code(), StatusCode::OK);
    assert_eq!(response.text(), "Auth service is healthy");
}

#[tokio::test]
async fn test_user_registration_success() {
    let app = common::create_test_app().await;
    let server = TestServer::new(app).unwrap();

    let user_data = json!({
        "email": "test@example.com",
        "display_name": "Test User",
        "password": "password123"
    });

    let response = server
        .post("/auth/register")
        .json(&user_data)
        .await;

    assert_eq!(response.status_code(), StatusCode::OK);
    
    let body: serde_json::Value = response.json();
    assert!(body["user"]["id"].is_string());
    assert_eq!(body["user"]["email"], "test@example.com");
    assert_eq!(body["user"]["display_name"], "Test User");
}

#[tokio::test]
async fn test_user_registration_duplicate_email() {
    let app = common::create_test_app().await;
    let server = TestServer::new(app).unwrap();

    let user_data = json!({
        "email": "duplicate@example.com",
        "display_name": "First User",
        "password": "password123"
    });

    // First registration should succeed
    let response1 = server
        .post("/auth/register")
        .json(&user_data)
        .await;
    assert_eq!(response1.status_code(), StatusCode::OK);

    // Second registration with same email should fail
    let response2 = server
        .post("/auth/register")
        .json(&user_data)
        .await;
    assert_eq!(response2.status_code(), StatusCode::CONFLICT);
}

#[tokio::test]
async fn test_user_registration_invalid_data() {
    let app = common::create_test_app().await;
    let server = TestServer::new(app).unwrap();

    // Test empty email
    let invalid_data = json!({
        "email": "",
        "display_name": "Test User",
        "password": "password123"
    });

    let response = server
        .post("/auth/register")
        .json(&invalid_data)
        .await;
    assert_eq!(response.status_code(), StatusCode::BAD_REQUEST);

    // Test short password
    let invalid_data = json!({
        "email": "test@example.com",
        "display_name": "Test User",
        "password": "123"
    });

    let response = server
        .post("/auth/register")
        .json(&invalid_data)
        .await;
    assert_eq!(response.status_code(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn test_user_login_success() {
    let app = common::create_test_app().await;
    let server = TestServer::new(app).unwrap();

    // First register a user
    let user_data = json!({
        "email": "login@example.com",
        "display_name": "Login User",
        "password": "password123"
    });

    let register_response = server
        .post("/auth/register")
        .json(&user_data)
        .await;
    assert_eq!(register_response.status_code(), StatusCode::OK);

    // Then login
    let login_data = json!({
        "email": "login@example.com",
        "password": "password123"
    });

    let login_response = server
        .post("/auth/login")
        .json(&login_data)
        .await;

    assert_eq!(login_response.status_code(), StatusCode::OK);
    
    let body: serde_json::Value = login_response.json();
    assert!(body["token"].is_string());
    assert_eq!(body["user"]["email"], "login@example.com");
}

#[tokio::test]
async fn test_user_login_invalid_credentials() {
    let app = common::create_test_app().await;
    let server = TestServer::new(app).unwrap();

    // Try to login with non-existent user
    let login_data = json!({
        "email": "nonexistent@example.com",
        "password": "password123"
    });

    let response = server
        .post("/auth/login")
        .json(&login_data)
        .await;

    assert_eq!(response.status_code(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_get_current_user_with_valid_token() {
    let app = common::create_test_app().await;
    let server = TestServer::new(app).unwrap();

    // Register and login to get token
    let (token, _user) = common::create_test_user(&server).await;

    let response = server
        .get("/auth/me")
        .add_header("Authorization".parse().unwrap(), format!("Bearer {}", token).parse().unwrap())
        .await;

    assert_eq!(response.status_code(), StatusCode::OK);
    
    let body: serde_json::Value = response.json();
    assert_eq!(body["email"], "test@example.com");
}

#[tokio::test]
async fn test_get_current_user_without_token() {
    let app = common::create_test_app().await;
    let server = TestServer::new(app).unwrap();

    let response = server
        .get("/auth/me")
        .await;

    assert_eq!(response.status_code(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_get_current_user_with_invalid_token() {
    let app = common::create_test_app().await;
    let server = TestServer::new(app).unwrap();

    let response = server
        .get("/auth/me")
        .add_header("Authorization".parse().unwrap(), "Bearer invalid_token".parse().unwrap())
        .await;

    assert_eq!(response.status_code(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_token_verification() {
    let app = common::create_test_app().await;
    let server = TestServer::new(app).unwrap();

    let (token, _user) = common::create_test_user(&server).await;

    let verify_data = json!({
        "token": token
    });

    let response = server
        .post("/auth/verify")
        .json(&verify_data)
        .await;

    assert_eq!(response.status_code(), StatusCode::OK);
    
    let body: serde_json::Value = response.json();
    assert_eq!(body["valid"], true);
    assert!(body["user_id"].is_string());
}

#[tokio::test]
async fn test_invalid_token_verification() {
    let app = common::create_test_app().await;
    let server = TestServer::new(app).unwrap();

    let verify_data = json!({
        "token": "invalid_token"
    });

    let response = server
        .post("/auth/verify")
        .json(&verify_data)
        .await;

    assert_eq!(response.status_code(), StatusCode::OK);
    
    let body: serde_json::Value = response.json();
    assert_eq!(body["valid"], false);
    assert!(body["user_id"].is_null());
}
