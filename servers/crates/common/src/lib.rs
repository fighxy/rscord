use config as cfg;
use serde::{Deserialize, Serialize};
use ulid::Ulid;
use chrono::{DateTime, Utc};
use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub bind_addr: Option<String>,
    pub mongodb_uri: Option<String>,
    pub redis_uri: Option<String>,
    pub rabbitmq_uri: Option<String>,
    pub s3_endpoint: Option<String>,
    pub s3_bucket: Option<String>,
    pub s3_access_key: Option<String>,
    pub s3_secret_key: Option<String>,
    pub jwt_secret: Option<String>,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            bind_addr: Some("127.0.0.1:8080".into()),
            mongodb_uri: Some("mongodb://localhost:27017".into()),
            redis_uri: Some("redis://127.0.0.1:6379/".into()),
            rabbitmq_uri: Some("amqp://guest:guest@127.0.0.1:5672/%2f".into()),
            s3_endpoint: Some("http://127.0.0.1:9000".into()),
            s3_bucket: Some("rscord".into()),
            s3_access_key: Some("minioadmin".into()),
            s3_secret_key: Some("minioadmin".into()),
            jwt_secret: Some("dev_secret_change_me".into()),
        }
    }
}

#[derive(thiserror::Error, Debug)]
pub enum ConfigError {
    #[error("config error: {0}")]
    Config(#[from] cfg::ConfigError),
}

pub fn load_config(env_prefix: &str) -> Result<AppConfig, ConfigError> {
    let mut builder = cfg::Config::builder()
        .set_default("bind_addr", AppConfig::default().bind_addr.unwrap())?
        .set_default("mongodb_uri", AppConfig::default().mongodb_uri.unwrap())?
        .set_default("redis_uri", AppConfig::default().redis_uri.unwrap())?
        .set_default("rabbitmq_uri", AppConfig::default().rabbitmq_uri.unwrap())?
        .set_default("s3_endpoint", AppConfig::default().s3_endpoint.unwrap())?
        .set_default("s3_bucket", AppConfig::default().s3_bucket.unwrap())?
        .set_default("s3_access_key", AppConfig::default().s3_access_key.unwrap())?
        .set_default("s3_secret_key", AppConfig::default().s3_secret_key.unwrap())?
        .set_default("jwt_secret", AppConfig::default().jwt_secret.unwrap())?;

    // Optional: load rscord.toml near binary
    if let Ok(toml) = std::fs::read_to_string("rscord.toml") {
        builder = builder.add_source(cfg::File::from_str(&toml, cfg::FileFormat::Toml));
    }

    // ENV overrides: RSCORD__KEY=value
    builder = builder.add_source(cfg::Environment::with_prefix(env_prefix).separator("__"));

    let config: AppConfig = builder.build()?.try_deserialize()?;
    Ok(config)
}

// Domain primitives
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct Id(#[serde(with = "ulid_as_string")] pub Ulid);

mod ulid_as_string {
    use super::*;
    pub fn serialize<S: serde::Serializer>(id: &Ulid, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&id.to_string())
    }
    pub fn deserialize<'de, D: serde::Deserializer<'de>>(d: D) -> Result<Ulid, D::Error> {
        let s = String::deserialize(d)?;
        Ulid::from_string(&s).map_err(serde::de::Error::custom)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: Id,
    pub email: String,
    pub display_name: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Guild {
    pub id: Id,
    pub name: String,
    pub owner_id: Id,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Channel {
    pub id: Id,
    pub guild_id: Id,
    pub name: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub exp: i64,
}

pub fn verify_jwt(token: &str, secret: &str) -> Result<Claims, jsonwebtoken::errors::Error> {
    let mut validation = Validation::new(Algorithm::HS256);
    validation.validate_exp = true;
    let data = decode::<Claims>(token, &DecodingKey::from_secret(secret.as_bytes()), &validation)?;
    Ok(data.claims)
}



