use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, sync::Arc};
use teloxide::{prelude::*, types::Me, utils::command::BotCommands};
use tokio::sync::RwLock;
use tower_http::cors::{Any, CorsLayer};
use tracing::{info, warn};
use uuid::Uuid;

mod auth;
mod redis_store;

use redis_store::RedisStore;

// Bot token from environment or hardcoded for development
const BOT_TOKEN: &str = "8485874967:AAHyf9abWYBwbTrlHFcY9RaP25IvRg8jbk8Use";

#[derive(Clone)]
pub struct AppState {
    pub bot: Bot,
    pub bot_username: String,
    pub auth_codes: Arc<RwLock<HashMap<String, AuthRequest>>>,
    pub user_sessions: Arc<RwLock<HashMap<i64, UserSession>>>,
    pub redis: Option<RedisStore>,
}

#[derive(BotCommands, Clone)]
#[command(rename_rule = "lowercase")]
enum Command {
    #[command(description = "Показать справку")]
    Help,
    #[command(description = "Начать регистрацию или вход")]
    Start,
    #[command(description = "Отменить операцию")]
    Cancel,
    #[command(description = "Зарегистрировать новый аккаунт")]
    Register,
    #[command(description = "Войти в существующий аккаунт")]
    Login,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthRequest {
    pub code: String,
    pub telegram_id: i64,
    pub telegram_username: Option<String>,
    pub first_name: String,
    pub last_name: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub expires_at: chrono::DateTime<chrono::Utc>,
    pub confirmed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum UserState {
    Start,
    ChoosingAction,
    RegisteringUsername,
    RegisteringPassword { username: String },
    RegisteringPasswordConfirm { username: String, password: String },
    LoggingInUsername,
    LoggingInPassword { username: String },
    LoggedInAwaitingCode { username: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserSession {
    pub telegram_id: i64,
    pub state: UserState,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub expires_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Serialize, Deserialize)]
pub struct CreateAuthCodeRequest {
    pub app_name: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct CreateAuthCodeResponse {
    pub auth_code: String,
    pub bot_url: String,
    pub expires_in: i64,
}

#[derive(Serialize, Deserialize)]
pub struct CheckAuthRequest {
    pub auth_code: String,
}

#[derive(Serialize, Deserialize)]
pub struct CheckAuthResponse {
    pub confirmed: bool,
    pub user_data: Option<AuthRequest>,
}

async fn command_handler(bot: Bot, msg: Message, cmd: Command, state: AppState) -> ResponseResult<()> {
    match cmd {
        Command::Help => {
            bot.send_message(msg.chat.id, Command::descriptions().to_string()).await?;
        }
        Command::Start => {
            let user_id = msg.from().unwrap().id.0 as i64;
            
            // Create new session
            let session = UserSession {
                telegram_id: user_id,
                state: UserState::ChoosingAction,
                created_at: chrono::Utc::now(),
                expires_at: chrono::Utc::now() + chrono::Duration::hours(1),
            };
            state.user_sessions.write().await.insert(user_id, session);
            
            bot.send_message(
                msg.chat.id,
                "👋 *Добро пожаловать в Radiate!*\n\nЭто бот для авторизации в приложении Radiate.\n\n🆕 *Новый пользователь?*\nИспользуйте /register\n\n🔑 *Уже есть аккаунт?*\nИспользуйте /login\n\nℹ️ *Нужна помощь?*\nИспользуйте /help"
            )
            .parse_mode(teloxide::types::ParseMode::MarkdownV2)
            .await?;
        }
        Command::Register => {
            let user_id = msg.from().unwrap().id.0 as i64;
            
            // Set state to registering username
            let mut sessions = state.user_sessions.write().await;
            if let Some(session) = sessions.get_mut(&user_id) {
                session.state = UserState::RegisteringUsername;
                bot.send_message(
                    msg.chat.id,
                    "📝 *Регистрация нового аккаунта*\n\nВведите желаемый username:\n\n✅ Только английские буквы, цифры и _\n✅ От 3 до 32 символов\n\nПример: john_doe123"
                )
                .parse_mode(teloxide::types::ParseMode::MarkdownV2)
                .await?;
            } else {
                bot.send_message(msg.chat.id, "❌ Сессия не найдена. Используйте /start").await?;
            }
        }
        Command::Login => {
            let user_id = msg.from().unwrap().id.0 as i64;
            
            // Set state to logging in username
            let mut sessions = state.user_sessions.write().await;
            if let Some(session) = sessions.get_mut(&user_id) {
                session.state = UserState::LoggingInUsername;
                bot.send_message(
                    msg.chat.id,
                    "🔐 *Вход в аккаунт*\n\nВведите ваш username, который вы использовали при регистрации:"
                )
                .parse_mode(teloxide::types::ParseMode::MarkdownV2)
                .await?;
            } else {
                bot.send_message(msg.chat.id, "❌ Сессия не найдена. Используйте /start").await?;
            }
        }
        Command::Cancel => {
            let user_id = msg.from().unwrap().id.0 as i64;
            state.user_sessions.write().await.remove(&user_id);
            bot.send_message(msg.chat.id, "❌ Операция отменена. Используйте /start для начала.").await?;
        }
    }
    Ok(())
}

async fn combined_handler(bot: Bot, msg: Message, state: AppState) -> ResponseResult<()> {
    // First try to parse as command
    if let Some(text) = msg.text() {
        if let Ok(cmd) = Command::parse(text, "RadiateAuth_bot") {
            return command_handler(bot, msg, cmd, state).await;
        }
    }
    
    // If not a command, handle as text message
    message_handler(bot, msg, state).await
}

async fn message_handler(bot: Bot, msg: Message, state: AppState) -> ResponseResult<()> {
    let user_id = msg.from().unwrap().id.0 as i64;
    let text = msg.text().unwrap_or("").trim();
    
    let mut sessions = state.user_sessions.write().await;
    if let Some(session) = sessions.get_mut(&user_id) {
        match &session.state {
            UserState::RegisteringUsername => {
                // Validate username
                if text.is_empty() || text.len() < 3 || text.len() > 32 || !text.chars().all(|c| c.is_ascii_alphanumeric() || c == '_') {
                    bot.send_message(
                        msg.chat.id,
                        "❌ Неверный username. Используйте только английские буквы, цифры и _ (от 3 до 32 символов).\n\nПопробуйте еще раз:"
                    ).await?;
                    return Ok(());
                }
                
                // Check if username exists via auth-service
                match check_username_availability(text).await {
                    Ok(false) => {
                        bot.send_message(
                            msg.chat.id,
                            "❌ Username уже занят. Попробуйте другой:"
                        ).await?;
                        return Ok(());
                    }
                    Ok(true) => {
                        let user = msg.from().unwrap();
                        
                        // Register user directly via auth-service
                        match register_user(
                            user.id.0 as i64, 
                            text, 
                            &user.first_name, 
                            user.username.as_ref().map(|s| s.to_string())
                        ).await {
                            Ok(_) => {
                                // Request auth code from auth-service (it will generate and store it)
                                match request_auth_code(user.id.0 as i64, text).await {
                                    Ok(response) => {
                                        session.state = UserState::LoggedInAwaitingCode { username: text.to_string() };
                                        
                                        bot.send_message(
                                            msg.chat.id,
                                            format!("🎉 Регистрация успешна!\n\n🔑 Ваш код подтверждения:\n\n`{}`\n\n⏱ Код действителен {} секунд\n\nВведите этот код в приложении Radiate.", response.code, response.expires_in)
                                        ).await?;
                                    }
                                    Err(e) => {
                                        bot.send_message(
                                            msg.chat.id,
                                            format!("❌ Ошибка генерации кода: {}\n\nИспользуйте /register для повторной попытки.", e)
                                        ).await?;
                                        session.state = UserState::ChoosingAction;
                                    }
                                }
                            }
                            Err(e) => {
                                session.state = UserState::ChoosingAction;
                                bot.send_message(
                                    msg.chat.id,
                                    format!("❌ Ошибка регистрации: {}\n\nИспользуйте /register для повторной попытки.", e)
                                ).await?;
                            }
                        }
                    }
                    Err(_) => {
                        bot.send_message(
                            msg.chat.id,
                            "❌ Ошибка проверки username. Попробуйте позже."
                        ).await?;
                        return Ok(());
                    }
                }
            }
// Removed password-based states - now using Telegram-only authentication
            UserState::LoggingInUsername => {
                // Check if user exists and login directly
                let user = msg.from().unwrap();
                
                match verify_telegram_login(user.id.0 as i64, text).await {
                    Ok(true) => {
                        // Request auth code from auth-service (it will generate and store it)
                        match request_auth_code(user.id.0 as i64, text).await {
                            Ok(response) => {
                                session.state = UserState::LoggedInAwaitingCode { username: text.to_string() };
                                
                                bot.send_message(
                                    msg.chat.id,
                                    format!("✅ Вход выполнен успешно!\n\n🔑 Ваш код подтверждения:\n\n`{}`\n\n⏱ Код действителен {} секунд\n\nВведите этот код в приложении Radiate.", response.code, response.expires_in)
                                ).await?;
                            }
                            Err(e) => {
                                bot.send_message(
                                    msg.chat.id,
                                    format!("❌ Ошибка генерации кода: {}\n\nПопробуйте еще раз.", e)
                                ).await?;
                            }
                        }
                    }
                    Ok(false) => {
                        bot.send_message(
                            msg.chat.id,
                            "❌ Пользователь не найден или неверные данные. Проверьте username или зарегистрируйтесь:\n\n/register - Регистрация"
                        ).await?;
                    }
                    Err(_) => {
                        bot.send_message(
                            msg.chat.id,
                            "❌ Ошибка проверки пользователя. Попробуйте позже."
                        ).await?;
                    }
                }
            }
            // Removed password-based login state - using direct Telegram authentication
            _ => {
                bot.send_message(
                    msg.chat.id,
                    "❓ Не понимаю. Используйте команды:\n\n/start - Начать\n/register - Регистрация\n/login - Вход\n/cancel - Отмена"
                ).await?;
            }
        }
    } else {
        bot.send_message(
            msg.chat.id,
            "❌ Сессия не найдена. Используйте /start для начала."
        ).await?;
    }
    
    Ok(())
}

async fn create_auth_code(
    State(state): State<AppState>,
    Json(_req): Json<CreateAuthCodeRequest>,
) -> Result<Json<CreateAuthCodeResponse>, StatusCode> {
    let auth_code = Uuid::new_v4().to_string();
    let expires_at = chrono::Utc::now() + chrono::Duration::minutes(10);

    let auth_request = AuthRequest {
        code: auth_code.clone(),
        telegram_id: 0, // Will be filled when user confirms
        telegram_username: None,
        first_name: String::new(),
        last_name: None,
        created_at: chrono::Utc::now(),
        expires_at,
        confirmed: false,
    };

    // Store in memory
    state.auth_codes.write().await.insert(auth_code.clone(), auth_request.clone());

    // Store in Redis if available
    if let Some(ref redis) = state.redis {
        if let Err(e) = redis.store_auth_request(&auth_code, &auth_request).await {
            warn!("Failed to store auth request in Redis: {}", e);
        }
    }

    let bot_url = format!("https://t.me/{}?start={}", state.bot_username, auth_code);

    Ok(Json(CreateAuthCodeResponse {
        auth_code: auth_code.clone(),
        bot_url,
        expires_in: 600, // 10 minutes
    }))
}

async fn check_auth_status(
    State(state): State<AppState>,
    Query(req): Query<CheckAuthRequest>,
) -> Result<Json<CheckAuthResponse>, StatusCode> {
    // Check memory first
    if let Some(auth_req) = state.auth_codes.read().await.get(&req.auth_code) {
        return Ok(Json(CheckAuthResponse {
            confirmed: auth_req.confirmed,
            user_data: if auth_req.confirmed { Some(auth_req.clone()) } else { None },
        }));
    }

    // Check Redis if available
    if let Some(ref redis) = state.redis {
        if let Ok(Some(auth_req)) = redis.get_auth_request(&req.auth_code).await {
            return Ok(Json(CheckAuthResponse {
                confirmed: auth_req.confirmed,
                user_data: if auth_req.confirmed { Some(auth_req) } else { None },
            }));
        }
    }

    Ok(Json(CheckAuthResponse {
        confirmed: false,
        user_data: None,
    }))
}

async fn health() -> &'static str {
    "Telegram Bot Service is healthy"
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    info!("Starting Telegram Bot Service...");

    let bot = Bot::new(BOT_TOKEN);
    
    // Get bot info
    let me: Me = bot.get_me().await?;
    info!("Bot username: @{}", me.username());

    // Initialize Redis (optional)
    let redis = match RedisStore::new("redis://127.0.0.1:6379").await {
        Ok(store) => {
            info!("Connected to Redis");
            Some(store)
        }
        Err(e) => {
            warn!("Failed to connect to Redis: {}. Using in-memory storage only.", e);
            None
        }
    };

    let state = AppState {
        bot: bot.clone(),
        bot_username: me.username().to_string(),
        auth_codes: Arc::new(RwLock::new(HashMap::new())),
        user_sessions: Arc::new(RwLock::new(HashMap::new())),
        redis,
    };

    // Start HTTP server for API
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/health", get(health))
        .route("/api/telegram/auth/create", post(create_auth_code))
        .route("/api/telegram/auth/check", get(check_auth_status))
        .with_state(state.clone())
        .layer(cors);

    let http_server = tokio::spawn(async move {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:14703").await.unwrap();
        info!("HTTP server listening on 127.0.0.1:14703");
        axum::serve(listener, app).await.unwrap();
    });

    // Start bot
    let bot_handler = tokio::spawn(async move {
        info!("Starting Telegram bot...");
        Dispatcher::builder(bot, Update::filter_message().endpoint(combined_handler))
        .dependencies(dptree::deps![state])
        .default_handler(|upd| async move {
            warn!("Unhandled update: {:?}", upd);
        })
            .build()
            .dispatch()
            .await;
    });

    // Wait for both services
    tokio::select! {
        _ = http_server => {
            info!("HTTP server stopped");
        }
        _ = bot_handler => {
            info!("Bot handler stopped");
        }
    }

    Ok(())
}

// Helper functions for auth-service integration
async fn check_username_availability(username: &str) -> Result<bool, Box<dyn std::error::Error>> {
    let client = reqwest::Client::new();
    let response = client
        .post("http://127.0.0.1:14701/api/auth/check-username") // Updated port
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({ "username": username }))
        .send()
        .await?;
    
    if response.status().is_success() {
        let result: serde_json::Value = response.json().await?;
        Ok(result["available"].as_bool().unwrap_or(false))
    } else {
        Err("Failed to check username".into())
    }
}

async fn check_user_exists(username: &str) -> Result<bool, Box<dyn std::error::Error>> {
    let client = reqwest::Client::new();
    let response = client
        .get(&format!("http://127.0.0.1:14701/api/users/@{}", username)) // Updated port
        .send()
        .await?;
    
    Ok(response.status().is_success())
}

async fn register_user(telegram_id: i64, username: &str, display_name: &str, telegram_username: Option<String>) -> Result<(), Box<dyn std::error::Error>> {
    let client = reqwest::Client::new();
    let response = client
        .post("http://127.0.0.1:14701/api/auth/telegram/register") // Updated port
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({
            "telegram_id": telegram_id,
            "telegram_username": telegram_username,
            "username": username,
            "display_name": display_name
        }))
        .send()
        .await?;
    
    if response.status().is_success() {
        Ok(())
    } else {
        let error_text = response.text().await.unwrap_or_default();
        Err(format!("Registration failed: {}", error_text).into())
    }
}

async fn verify_telegram_login(telegram_id: i64, username: &str) -> Result<bool, Box<dyn std::error::Error>> {
    let client = reqwest::Client::new();
    let response = client
        .post("http://127.0.0.1:14701/api/auth/telegram/login") // Updated port
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({
            "telegram_id": telegram_id,
            "username": username
        }))
        .send()
        .await?;
    
    Ok(response.status().is_success())
}

#[derive(serde::Deserialize)]
struct AuthCodeResponse {
    code: String,
    expires_in: i64,
}

async fn request_auth_code(telegram_id: i64, username: &str) -> Result<AuthCodeResponse, Box<dyn std::error::Error>> {
    let client = reqwest::Client::new();
    let response = client
        .post("http://127.0.0.1:14701/api/auth/telegram/request-code")
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({
            "telegram_id": telegram_id,
            "username": username
        }))
        .send()
        .await?;
    
    if response.status().is_success() {
        let result: AuthCodeResponse = response.json().await?;
        Ok(result)
    } else {
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        Err(format!("Failed to request auth code: {}", error_text).into())
    }
}