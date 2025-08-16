use axum::{extract::Query, routing::get, Json, Router};  // Убрал post, если не нужен
use aws_sdk_s3::{Client as S3Client, config::{Credentials, Region}, presigning::PresigningConfig};
use rscord_common::load_config;
use std::net::SocketAddr;
use tracing::info;
use serde::{Deserialize, Serialize};
use std::time::Duration;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    let cfg = load_config("RSCORD").expect("load config");
    let addr: SocketAddr = cfg
        .bind_addr
        .as_deref()
        .unwrap_or("127.0.0.1:14704")
        .parse()
        .expect("bind addr");

    let app = Router::new()
        .route("/health", get(|| async { "ok" }))
        .route("/files/presign-put", get(presign_put))
        .route("/files/presign-get", get(presign_get));
    info!("rscord-files listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

#[derive(Deserialize)]
struct PresignQuery { key: String, expires: Option<u64> }

#[derive(Serialize)]
struct PresignResponse { url: String }

async fn presign_put(Query(q): Query<PresignQuery>) -> Json<PresignResponse> {
    let cfg = load_config("RSCORD").expect("cfg");
    let s3 = s3_client(&cfg).await;
    let bucket = cfg.s3_bucket.expect("S3 bucket not configured");
    let expires = q.expires.unwrap_or(300);
    let presigned = s3
        .put_object()
        .bucket(&bucket)
        .key(&q.key)
        .presigned(PresigningConfig::expires_in(Duration::from_secs(expires)).expect("Invalid presigning config"))
        .await
        .expect("Failed to generate presigned URL");
    Json(PresignResponse { url: presigned.uri().to_string() })
}

async fn presign_get(Query(q): Query<PresignQuery>) -> Json<PresignResponse> {
    let cfg = load_config("RSCORD").expect("cfg");
    let s3 = s3_client(&cfg).await;
    let bucket = cfg.s3_bucket.expect("S3 bucket not configured");
    let expires = q.expires.unwrap_or(300);
    let presigned = s3
        .get_object()
        .bucket(&bucket)
        .key(&q.key)
        .presigned(PresigningConfig::expires_in(Duration::from_secs(expires)).expect("Invalid presigning config"))
        .await
        .expect("Failed to generate presigned URL");
    Json(PresignResponse { url: presigned.uri().to_string() })
}

async fn s3_client(cfg: &rscord_common::AppConfig) -> S3Client {
    let credentials = Credentials::new(
        cfg.s3_access_key.as_ref().unwrap_or(&"minioadmin".to_string()),
        cfg.s3_secret_key.as_ref().unwrap_or(&"minioadmin".to_string()),
        None,
        None,
        "",
    );
    let s3_config = aws_sdk_s3::config::Builder::new()
        .endpoint_url(cfg.s3_endpoint.as_ref().unwrap_or(&"http://localhost:9000".to_string()))
        .credentials_provider(credentials)
        .region(Region::new("us-east-1"))
        .force_path_style(true)
        .build();
    S3Client::from_conf(s3_config)
}


