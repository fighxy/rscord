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
                "👋 Добро пожаловать в RSCord!\n\nВыберите действие:\n\n/register - Зарегистрировать новый аккаунт\n/login - Войти в существующий аккаунт"
            ).await?;
        }
        Command::Register => {
            let user_id = msg.from().unwrap().id.0 as i64;
            
            // Set state to registering username
            let mut sessions = state.user_sessions.write().await;
            if let Some(session) = sessions.get_mut(&user_id) {
                session.state = UserState::RegisteringUsername;
                bot.send_message(
                    msg.chat.id,
                    "📝 Регистрация нового аккаунта\n\nВведите желаемый username (только английские буквы, цифры и _):"
                ).await?;
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
                    "🔐 Вход в аккаунт\n\nВведите ваш username:"
                ).await?;
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
        if let Ok(cmd) = Command::parse(text, "RSCordBot") {
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
                        session.state = UserState::RegisteringPassword { username: text.to_string() };
                        bot.send_message(
                            msg.chat.id,
                            format!("✅ Username '{}' доступен!\n\nТеперь введите пароль (минимум 6 символов):", text)
                        ).await?;
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
            UserState::RegisteringPassword { username } => {
                if text.len() < 6 {
                    bot.send_message(
                        msg.chat.id,
                        "❌ Пароль должен содержать минимум 6 символов. Попробуйте еще раз:"
                    ).await?;
                    return Ok(());
                }
                
                session.state = UserState::RegisteringPasswordConfirm { 
                    username: username.clone(), 
                    password: text.to_string() 
                };
                
                bot.send_message(
                    msg.chat.id,
                    "🔐 Подтвердите пароль (введите его еще раз):"
                ).await?;
            }
            UserState::RegisteringPasswordConfirm { username, password } => {
                if text != password {
                    bot.send_message(
                        msg.chat.id,
                        "❌ Пароли не совпадают. Попробуйте еще раз:"
                    ).await?;
                    return Ok(());
                }
                
                // Register user via auth-service
                match register_user(username, text, &msg.from().unwrap().first_name).await {
                    Ok(_) => {
                        session.state = UserState::LoggedInAwaitingCode { username: username.clone() };
                        
                        // Generate confirmation code
                        let code = generate_confirmation_code();
                        
                        bot.send_message(
                            msg.chat.id,
                            format!("🎉 Регистрация успешна!\n\n🔑 Ваш код подтверждения:\n\n`{}`\n\nВведите этот код в приложении RSCord.", code)
                        ).await?;
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
            UserState::LoggingInUsername => {
                // Check if user exists
                match check_user_exists(text).await {
                    Ok(true) => {
                        session.state = UserState::LoggingInPassword { username: text.to_string() };
                        bot.send_message(
                            msg.chat.id,
                            "🔐 Введите ваш пароль:"
                        ).await?;
                    }
                    Ok(false) => {
                        bot.send_message(
                            msg.chat.id,
                            "❌ Пользователь не найден. Проверьте username или зарегистрируйтесь:\n\n/register - Регистрация"
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
            UserState::LoggingInPassword { username } => {
                // Verify login credentials
                match verify_login(username, text).await {
                    Ok(true) => {
                        session.state = UserState::LoggedInAwaitingCode { username: username.clone() };
                        
                        // Generate confirmation code
                        let code = generate_confirmation_code();
                        
                        bot.send_message(
                            msg.chat.id,
                            format!("✅ Вход выполнен успешно!\n\n🔑 Ваш код подтверждения:\n\n`{}`\n\nВведите этот код в приложении RSCord.", code)
                        ).await?;
                    }
                    Ok(false) => {
                        bot.send_message(
                            msg.chat.id,
                            "❌ Неверный пароль. Попробуйте еще раз:"
                        ).await?;
                    }
                    Err(_) => {
                        bot.send_message(
                            msg.chat.id,
                            "❌ Ошибка входа. Попробуйте позже."
                        ).await?;
                    }
                }
            }
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
        .post("http://127.0.0.1:14700/api/auth/check-username")
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
        .get(&format!("http://127.0.0.1:14700/api/users/@{}", username))
        .send()
        .await?;
    
    Ok(response.status().is_success())
}

async fn register_user(username: &str, password: &str, display_name: &str) -> Result<(), Box<dyn std::error::Error>> {
    let client = reqwest::Client::new();
    let response = client
        .post("http://127.0.0.1:14700/api/auth/register")
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({
            "email": format!("{}@telegram.local", username), // Fake email for Telegram users
            "username": username,
            "display_name": display_name,
            "password": password
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

async fn verify_login(username: &str, password: &str) -> Result<bool, Box<dyn std::error::Error>> {
    let client = reqwest::Client::new();
    let response = client
        .post("http://127.0.0.1:14700/api/auth/login")
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({
            "email": format!("{}@telegram.local", username),
            "password": password
        }))
        .send()
        .await?;
    
    Ok(response.status().is_success())
}

fn generate_confirmation_code() -> String {
    use rand::Rng;
    let mut rng = rand::thread_rng();
    format!("{:06}", rng.gen_range(100000..999999))
}