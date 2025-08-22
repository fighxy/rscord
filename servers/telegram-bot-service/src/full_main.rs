use std::{collections::HashMap, sync::Arc};
use teloxide::{prelude::*, utils::command::BotCommands};
use tokio::sync::RwLock;
use tracing::info;

const BOT_TOKEN: &str = "8485874967:AAHyf9abWYBwbTrlHFcY9RaP25IvRg8jbk8";

#[derive(Clone)]
pub struct AppState {
    pub auth_codes: Arc<RwLock<HashMap<String, AuthCode>>>,
    pub user_sessions: Arc<RwLock<HashMap<i64, UserSession>>>,
}

#[derive(Debug, Clone)]
pub struct AuthCode {
    pub code: String,
    pub telegram_id: i64,
    pub username: String,
    pub created_at: std::time::SystemTime,
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

// Функция генерации 6-значного кода
fn generate_six_digit_code() -> String {
    use rand::Rng;
    let mut rng = rand::thread_rng();
    format!("{:06}", rng.gen_range(100000..999999))
}

// Проверка username через auth-service
async fn check_username_availability(username: &str) -> Result<bool, reqwest::Error> {
    let client = reqwest::Client::new();
    let response = client
        .post("http://localhost:14701/api/auth/check-username")
        .json(&serde_json::json!({"username": username}))
        .send()
        .await?;
    
    let result: serde_json::Value = response.json().await?;
    Ok(result["available"].as_bool().unwrap_or(false))
}

// Регистрация пользователя через auth-service
async fn register_user_via_auth(telegram_id: i64, telegram_username: Option<String>, username: &str) -> Result<bool, reqwest::Error> {
    let client = reqwest::Client::new();
    let response = client
        .post("http://localhost:14701/api/auth/telegram/register")
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

// Проверка пользователя через auth-service
async fn verify_user_via_auth(telegram_id: i64, username: &str) -> Result<bool, reqwest::Error> {
    let client = reqwest::Client::new();
    let response = client
        .post("http://localhost:14701/api/auth/telegram/login")
        .json(&serde_json::json!({
            "telegram_id": telegram_id,
            "username": username
        }))
        .send()
        .await?;
    
    Ok(response.status().is_success())
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();
    
    let bot = Bot::new(BOT_TOKEN);
    
    let state = AppState {
        auth_codes: Arc::new(RwLock::new(HashMap::new())),
        user_sessions: Arc::new(RwLock::new(HashMap::new())),
    };
    
    info!("Starting Radiate Telegram Bot...");
    
    teloxide::repl(bot, move |bot: Bot, msg: Message| {
        let state = state.clone();
        async move {
            let user_id = msg.from().unwrap().id.0 as i64;
            let username = msg.from().unwrap().username.clone();
            
            if let Some(text) = msg.text() {
                let chat_id = msg.chat.id;
                let msg_id = msg.id;
                if let Ok(cmd) = Command::parse(text, "RadiateAuth_bot") {
                    handle_command(bot, chat_id, msg_id, cmd, state, user_id, username).await?;
                } else {
                    handle_text_message(bot, chat_id, msg_id, state, user_id, text).await?;
                }
            }
            Ok(())
        }
    }).await;
}

async fn handle_command(
    bot: Bot, 
    chat_id: ChatId,
    _msg_id: MessageId,
    cmd: Command, 
    state: AppState, 
    user_id: i64,
    username: Option<String>
) -> ResponseResult<()> {
    match cmd {
        Command::Start => {
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
                    msg.chat.id,
                    "❌ Сессия не найдена.\n\nИспользуйте /register для регистрации."
                ).await?;
            }
        }
        
        Command::GetCode => {
            let sessions = state.user_sessions.read().await;
            if let Some(session) = sessions.get(&user_id) {
                if let SessionState::Registered(ref stored_username) = session.state {
                    // Генерируем 6-значный код
                    let code = generate_six_digit_code();
                    
                    // Сохраняем код
                    let mut codes = state.auth_codes.write().await;
                    codes.insert(code.clone(), AuthCode {
                        code: code.clone(),
                        telegram_id: user_id,
                        username: stored_username.clone(),
                        created_at: std::time::SystemTime::now(),
                    });
                    
                    bot.send_message(
                        chat_id,
                        format!(
                            "🔑 **Ваш код для входа в приложение:**\n\n\
                            `{}`\n\n\
                            📱 Введите этот код в приложении Radiate для входа в аккаунт @{}\n\n\
                            ⏰ Код действителен 10 минут.",
                            code, stored_username
                        )
                    ).await?;
                } else {
                    bot.send_message(
                        chat_id,
                        "❌ Вы не зарегистрированы.\n\nИспользуйте /register для создания аккаунта."
                    ).await?;
                }
            } else {
                bot.send_message(
                    msg.chat.id,
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
    _msg_id: MessageId,
    state: AppState,
    user_id: i64,
    text: &str,
) -> ResponseResult<()> {
    let mut sessions = state.user_sessions.write().await;
    
    if let Some(session) = sessions.get_mut(&user_id) {
        match &session.state {
            SessionState::WaitingForUsername => {
                let username = text.trim();
                
                // Валидация username
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
                
                // Проверяем доступность username
                match check_username_availability(username).await {
                    Ok(true) => {
                        // Username доступен, регистрируем пользователя
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
                                bot.send_message(
                                    chat_id,
                                    "❌ Ошибка регистрации на сервере.\n\nПопробуйте еще раз или используйте другой username."
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
                    msg.chat.id,
                    "❓ Не понимаю эту команду.\n\nИспользуйте /help для списка команд."
                ).await?;
            }
        }
    } else {
        bot.send_message(
            msg.chat.id,
            "👋 Привет! Используйте /start для начала работы."
        ).await?;
    }
    
    Ok(())
}