use std::{collections::HashMap, sync::Arc};
use teloxide::{prelude::*, utils::command::BotCommands};
use tokio::sync::RwLock;
use tracing::info;

const BOT_TOKEN: &str = "8485874967:AAHyf9abWYBwbTrlHFcY9RaP25IvRg8jbk8";

#[derive(Clone)]
pub struct AppState {
    pub user_sessions: Arc<RwLock<HashMap<i64, UserSession>>>,
}

#[derive(Debug, Clone)]
pub struct UserSession {
    pub telegram_id: i64,
    pub username: Option<String>,
    pub state: SessionState,
}

#[derive(Debug, Clone)]
pub enum SessionState {
    Start,
    WaitingForUsername,
    Registered(String),
}

#[derive(BotCommands, Clone)]
#[command(rename_rule = "lowercase")]
enum Command {
    #[command(description = "Добро пожаловать в Radiate")]
    Start,
    #[command(description = "Регистрация нового пользователя")]
    Register,
    #[command(description = "Вход для существующего пользователя")]
    Login,
    #[command(description = "Получить код для входа в приложение")]
    GetCode,
    #[command(description = "Показать справку")]
    Help,
}


async fn check_username_availability(username: &str) -> Result<bool, reqwest::Error> {
    let client = reqwest::Client::new();
    let response = client
        .post("http://127.0.0.1:14701/api/auth/check-username")
        .json(&serde_json::json!({"username": username}))
        .send()
        .await?;
    
    let result: serde_json::Value = response.json().await?;
    Ok(result["available"].as_bool().unwrap_or(false))
}

async fn register_user_via_auth(telegram_id: i64, telegram_username: Option<String>, username: &str) -> Result<bool, reqwest::Error> {
    let client = reqwest::Client::new();
    let response = client
        .post("http://127.0.0.1:14701/api/auth/telegram/register")
        .json(&serde_json::json!({
            "telegram_id": telegram_id,
            "telegram_username": telegram_username,
            "username": username,
            "display_name": username
        }))
        .send()
        .await?;
    
    Ok(response.status().is_success())
}

async fn verify_user_via_auth(telegram_id: i64, username: &str) -> Result<bool, reqwest::Error> {
    let client = reqwest::Client::new();
    let response = client
        .post("http://127.0.0.1:14701/api/auth/telegram/login")
        .json(&serde_json::json!({
            "telegram_id": telegram_id,
            "username": username
        }))
        .send()
        .await?;
    
    Ok(response.status().is_success())
}

async fn find_user_by_telegram_id(telegram_id: i64) -> Result<Option<String>, reqwest::Error> {
    let client = reqwest::Client::new();
    let response = client
        .get(&format!("http://127.0.0.1:14701/api/users/telegram/{}", telegram_id))
        .send()
        .await?;
    
    if response.status().is_success() {
        let result: serde_json::Value = response.json().await?;
        Ok(Some(result["username"].as_str().unwrap_or("").to_string()))
    } else {
        Ok(None)
    }
}

async fn request_auth_code_from_service(telegram_id: i64, username: &str) -> Result<(String, i64), reqwest::Error> {
    let client = reqwest::Client::new();
    let response = client
        .post("http://127.0.0.1:14701/api/auth/telegram/request-code")
        .json(&serde_json::json!({
            "telegram_id": telegram_id,
            "username": username
        }))
        .send()
        .await?;
    
    if response.status().is_success() {
        let result: serde_json::Value = response.json().await?;
        let code = result["code"].as_str().unwrap_or("000000").to_string();
        let expires_in = result["expires_in"].as_i64().unwrap_or(600);
        Ok((code, expires_in))
    } else {
        Err(reqwest::Error::from(response.error_for_status().unwrap_err()))
    }
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();
    
    let bot = Bot::new(BOT_TOKEN);
    
    let state = AppState {
        user_sessions: Arc::new(RwLock::new(HashMap::new())),
    };
    
    info!("Starting Radiate Telegram Bot...");
    
    teloxide::repl(bot, move |bot: Bot, msg: Message| {
        let state = state.clone();
        async move {
            let user_id = msg.from().unwrap().id.0 as i64;
            let username = msg.from().unwrap().username.clone();
            let chat_id = msg.chat.id;
            
            if let Some(text) = msg.text() {
                if let Ok(cmd) = Command::parse(text, "RadiateAuth_bot") {
                    handle_command(bot, chat_id, cmd, state, user_id, username).await?;
                } else {
                    handle_text_message(bot, chat_id, state, user_id, text).await?;
                }
            }
            Ok(())
        }
    }).await;
}

async fn handle_command(
    bot: Bot, 
    chat_id: ChatId,
    cmd: Command, 
    state: AppState, 
    user_id: i64,
    username: Option<String>
) -> ResponseResult<()> {
    match cmd {
        Command::Start => {
            // Логируем telegram_id для отладки
            info!("User with telegram_id {} started the bot", user_id);
            
            // Проверяем, существует ли пользователь в базе данных
            let mut sessions = state.user_sessions.write().await;
            let session = sessions.entry(user_id).or_insert(UserSession {
                telegram_id: user_id,
                username: username.clone(),
                state: SessionState::Start,
            });
            
            // Проверяем, есть ли пользователь в базе
            match find_user_by_telegram_id(user_id).await {
                Ok(Some(existing_username)) => {
                session.state = SessionState::Registered(existing_username.clone());
                bot.send_message(
                    chat_id,
                    format!(
                        "🌟 **Добро пожаловать в Radiate, @{}!**\n\n\
                        Вы уже зарегистрированы в системе.\n\n\
                        📱 **Доступные действия:**\n\
                        /getcode - Получить код для входа в приложение\n\
                        /help - Справка по командам",
                        existing_username
                    )
                ).await?;
            } else {
                bot.send_message(
                    chat_id,
                    "🌟 **Добро пожаловать в Radiate!**\n\n\
                    Radiate - это современное приложение для голосового общения и совместной работы. \
                    Создавайте команды, общайтесь голосом и работайте вместе!\n\n\
                    📱 **Для начала работы:**\n\
                    /register - Регистрация нового аккаунта\n\
                    /login - Вход в существующий аккаунт\n\
                    /getcode - Получить код для входа в приложение\n\n\
                    ❓ /help - Справка по командам"
                ).await?;
            }
        }
        
        Command::Register => {
            let mut sessions = state.user_sessions.write().await;
            let session = sessions.entry(user_id).or_insert(UserSession {
                telegram_id: user_id,
                username: username.clone(),
                state: SessionState::Start,
            });
            
            session.state = SessionState::WaitingForUsername;
            
            bot.send_message(
                chat_id,
                "📝 **Регистрация нового аккаунта**\n\n\
                Введите желаемый username для приложения Radiate:\n\
                • Только английские буквы, цифры и _\n\
                • От 3 до 32 символов\n\
                • Будет использоваться в приложении как @username"
            ).await?;
        }
        
        Command::Login => {
            let sessions = state.user_sessions.read().await;
            if let Some(session) = sessions.get(&user_id) {
                if let SessionState::Registered(ref stored_username) = session.state {
                    match verify_user_via_auth(user_id, stored_username).await {
                        Ok(true) => {
                            bot.send_message(
                                chat_id,
                                format!("✅ **Вход выполнен успешно!**\n\nВаш username: @{}\n\n🔑 Используйте /getcode для получения кода входа в приложение.", stored_username)
                            ).await?;
                        }
                        Ok(false) => {
                            bot.send_message(
                                chat_id,
                                "❌ Пользователь не найден или данные не совпадают.\n\nИспользуйте /register для регистрации."
                            ).await?;
                        }
                        Err(_) => {
                            bot.send_message(
                                chat_id,
                                "⚠️ Ошибка подключения к серверу. Попробуйте позже."
                            ).await?;
                        }
                    }
                } else {
                    bot.send_message(
                        chat_id,
                        "❌ Вы не зарегистрированы.\n\nИспользуйте /register для создания аккаунта."
                    ).await?;
                }
            } else {
                bot.send_message(
                    chat_id,
                    "❌ Сессия не найдена.\n\nИспользуйте /register для регистрации."
                ).await?;
            }
        }
        
        Command::GetCode => {
            let sessions = state.user_sessions.read().await;
            if let Some(session) = sessions.get(&user_id) {
                if let SessionState::Registered(ref stored_username) = session.state {
                    // Запрашиваем код у auth-service
                    match request_auth_code_from_service(user_id, stored_username).await {
                        Ok((code, expires_in)) => {
                            let minutes = expires_in / 60;
                            let seconds = expires_in % 60;
                            
                            let time_text = if expires_in >= 600 {
                                "10 минут".to_string()
                            } else if minutes > 0 {
                                format!("{} мин {} сек", minutes, seconds)
                            } else {
                                format!("{} сек", seconds)
                            };
                            
                            let message = if expires_in < 600 {
                                format!(
                                    "🔑 **Ваш код для входа в приложение:**\n\n\
                                    `{}`\n\n\
                                    📱 Введите этот код в приложении Radiate для входа в аккаунт @{}\n\n\
                                    ⏰ Код действителен еще {} (существующий код).",
                                    code, stored_username, time_text
                                )
                            } else {
                                format!(
                                    "🔑 **Ваш код для входа в приложение:**\n\n\
                                    `{}`\n\n\
                                    📱 Введите этот код в приложении Radiate для входа в аккаунт @{}\n\n\
                                    ⏰ Код действителен {}.",
                                    code, stored_username, time_text
                                )
                            };
                            
                            bot.send_message(chat_id, message).await?;
                        }
                        Err(_) => {
                            bot.send_message(
                                chat_id,
                                "⚠️ Ошибка генерации кода. Попробуйте позже."
                            ).await?;
                        }
                    }
                } else {
                    bot.send_message(
                        chat_id,
                        "❌ Вы не зарегистрированы.\n\nИспользуйте /register для создания аккаунта."
                    ).await?;
                }
            } else {
                bot.send_message(
                    chat_id,
                    "❌ Сессия не найдена.\n\nИспользуйте /start для начала."
                ).await?;
            }
        }
        
        Command::Help => {
            bot.send_message(
                chat_id,
                "🤖 **Radiate Telegram Bot - Справка**\n\n\
                **Команды:**\n\
                /start - Добро пожаловать и информация\n\
                /register - Регистрация нового пользователя\n\
                /login - Вход в существующий аккаунт\n\
                /getcode - Получить код для входа в приложение\n\
                /help - Показать эту справку\n\n\
                📱 **Как использовать:**\n\
                1. Сначала /register для создания аккаунта\n\
                2. Затем /getcode для получения кода\n\
                3. Введите код в приложении Radiate"
            ).await?;
        }
    }
    Ok(())
}

async fn handle_text_message(
    bot: Bot,
    chat_id: ChatId,
    state: AppState,
    user_id: i64,
    text: &str,
) -> ResponseResult<()> {
    let mut sessions = state.user_sessions.write().await;
    
    if let Some(session) = sessions.get_mut(&user_id) {
        match &session.state {
            SessionState::WaitingForUsername => {
                let username = text.trim();
                
                if username.is_empty() || username.len() < 3 || username.len() > 32 || 
                   !username.chars().all(|c| c.is_ascii_alphanumeric() || c == '_') {
                    bot.send_message(
                        chat_id,
                        "❌ **Неверный username**\n\n\
                        Username должен:\n\
                        • Содержать только английские буквы, цифры и _\n\
                        • Быть от 3 до 32 символов\n\n\
                        Попробуйте еще раз:"
                    ).await?;
                    return Ok(());
                }
                
                match check_username_availability(username).await {
                    Ok(true) => {
                        match register_user_via_auth(user_id, session.username.clone(), username).await {
                            Ok(true) => {
                                session.state = SessionState::Registered(username.to_string());
                                bot.send_message(
                                    chat_id,
                                    format!(
                                        "🎉 **Регистрация успешна!**\n\n\
                                        Ваш аккаунт создан:\n\
                                        👤 Username: @{}\n\
                                        🆔 Telegram ID: {}\n\n\
                                        🔑 Используйте /getcode для получения кода входа в приложение.",
                                        username, user_id
                                    )
                                ).await?;
                            }
                            Ok(false) => {
                                // Проверяем, не связана ли ошибка с уже существующим аккаунтом
                                bot.send_message(
                                    chat_id,
                                    "❌ **Регистрация невозможна**\n\n\
                                    Возможные причины:\n\
                                    • Username уже занят\n\
                                    • На этот Telegram аккаунт уже зарегистрирован пользователь\n\n\
                                    Попробуйте другой username или используйте /login для входа в существующий аккаунт."
                                ).await?;
                            }
                            Err(_) => {
                                bot.send_message(
                                    chat_id,
                                    "⚠️ Ошибка подключения к серверу.\n\nПопробуйте позже."
                                ).await?;
                            }
                        }
                    }
                    Ok(false) => {
                        bot.send_message(
                            chat_id,
                            format!("❌ Username **@{}** уже занят.\n\nПопробуйте другой:", username)
                        ).await?;
                    }
                    Err(_) => {
                        bot.send_message(
                            chat_id,
                            "⚠️ Ошибка проверки username.\n\nПопробуйте позже."
                        ).await?;
                    }
                }
            }
            _ => {
                bot.send_message(
                    chat_id,
                    "❓ Не понимаю эту команду.\n\nИспользуйте /help для списка команд."
                ).await?;
            }
        }
    } else {
        bot.send_message(
            chat_id,
            "👋 Привет! Используйте /start для начала работы."
        ).await?;
    }
    
    Ok(())
}