use axum::{extract::Query, routing::{get, post}, Json, Router};
use aws_config::BehaviorVersion;
use aws_sdk_s3::primitives::ByteStream;
use aws_sdk_s3::Client as S3Client;
use rscord_common::load_config;
use std::net::SocketAddr;
use tracing::info;
use serde::{Deserialize, Serialize};

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
    let bucket = cfg.s3_bucket.unwrap();
    let expires = q.expires.unwrap_or(300);
    let presigned = s3
        .put_object()
        .bucket(&bucket)
        .key(&q.key)
        .body(ByteStream::from_static(b""))
        .presigned(std::time::Duration::from_secs(expires))
        .await
        .unwrap();
    Json(PresignResponse { url: presigned.uri().to_string() })
}

async fn presign_get(Query(q): Query<PresignQuery>) -> Json<PresignResponse> {
    let cfg = load_config("RSCORD").expect("cfg");
    let s3 = s3_client(&cfg).await;
    let bucket = cfg.s3_bucket.unwrap();
    let expires = q.expires.unwrap_or(300);
    let presigned = s3
        .get_object()
        .bucket(&bucket)
        .key(&q.key)
        .presigned(std::time::Duration::from_secs(expires))
        .await
        .unwrap();
    Json(PresignResponse { url: presigned.uri().to_string() })
}

async fn s3_client(cfg: &rscord_common::AppConfig) -> S3Client {
    let mut loader = aws_config::defaults(BehaviorVersion::latest()).load().await;
    // Note: for MinIO, you may need to customize endpoint and creds
    S3Client::new(&loader)
}


