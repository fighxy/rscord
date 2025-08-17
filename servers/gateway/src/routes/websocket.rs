use axum::{
    extract::{ws::WebSocketUpgrade, State, Query},
    response::Response,
    http::StatusCode,
};
use serde::Deserialize;
use crate::websocket::handler::WebSocketHandler;
use crate::AppState;

#[derive(Deserialize)]
pub struct WsQuery {
    token: Option<String>,
}

pub async fn websocket_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
    Query(params): Query<WsQuery>,
) -> Result<Response, StatusCode> {
    // Валидация JWT токена
    if let Some(token) = params.token {
        // TODO: Добавить валидацию JWT
        let handler = WebSocketHandler::new(state.clone());
        Ok(ws.on_upgrade(move |socket| handler.handle_socket(socket, token)))
    } else {
        Err(StatusCode::UNAUTHORIZED)
    }
}
