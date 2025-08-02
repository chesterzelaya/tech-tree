use crate::cache::WikiEngineCache;
use crate::types::{AnalysisResult, SearchRequest, Result};
use crate::WikiEngine;
use axum::{
    debug_handler,
    extract::{Query, State},
    response::Json,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tower_http::cors::CorsLayer;

pub type SharedState = Arc<WikiEngineState>;

pub struct WikiEngineState {
    pub engine: WikiEngine,
    pub cache: Arc<WikiEngineCache>,
}

impl WikiEngineState {
    pub fn new() -> Result<Self> {
        let cache = Arc::new(WikiEngineCache::new());
        let engine = WikiEngine::new(Arc::clone(&cache))?;
        
        Ok(Self { engine, cache })
    }
}

#[derive(Debug, Deserialize)]
pub struct AnalyzeQuery {
    term: String,
    max_depth: Option<u8>,
    max_results: Option<u8>,
}

#[derive(Debug, Serialize)]
pub struct ApiResponse<T> {
    success: bool,
    data: Option<T>,
    error: Option<String>,
    timestamp: String,
}

impl<T> ApiResponse<T> {
    pub fn success(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
            timestamp: chrono::Utc::now().to_rfc3339(),
        }
    }

    pub fn error(message: String) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(message),
            timestamp: chrono::Utc::now().to_rfc3339(),
        }
    }
}

pub fn create_router_with_state(state: SharedState) -> Result<Router> {
    let router = Router::new()
        .route("/health", get(health_check))
        .route("/analyze", post(analyze_term))
        .route("/suggest", get(suggest_terms))
        .layer(CorsLayer::permissive())
        .with_state(state);
    
    Ok(router)
}

pub fn create_router() -> Result<Router> {
    // For backward compatibility, create state internally
    let state = Arc::new(WikiEngineState::new()?);
    create_router_with_state(state)
}

pub async fn health_check() -> Json<ApiResponse<HashMap<String, String>>> {
    let mut health_data = HashMap::new();
    health_data.insert("status".to_string(), "healthy".to_string());
    health_data.insert("service".to_string(), "wiki-engine-backend".to_string());
    health_data.insert("version".to_string(), env!("CARGO_PKG_VERSION").to_string());
    
    Json(ApiResponse::success(health_data))
}

#[debug_handler]
pub async fn analyze_term(
    State(state): State<SharedState>,
    Json(request): Json<SearchRequest>,
) -> Json<ApiResponse<AnalysisResult>> {
    tracing::info!("Analysis endpoint called for term: {}", request.term);
    
    // Use the real WikiEngine to analyze the term with Wikipedia API calls
    match state.engine.analyze_recursive(&request).await {
        Ok(result) => Json(ApiResponse::success(result)),
        Err(e) => {
            tracing::error!("Analysis failed for term '{}': {}", request.term, e);
            Json(ApiResponse::error(format!("Analysis failed: {}", e)))
        }
    }
}

#[derive(Debug, Serialize)]
pub struct SearchSuggestion {
    pub term: String,
    pub confidence: f32,
    pub category: String,
}

#[derive(Debug, Deserialize)]
pub struct SuggestQuery {
    pub query: String,
    pub limit: Option<u8>,
}

#[debug_handler]
pub async fn suggest_terms(
    State(state): State<SharedState>,
    Query(params): Query<SuggestQuery>,
) -> Json<ApiResponse<Vec<SearchSuggestion>>> {
    tracing::info!("Suggest endpoint called for query: {}", params.query);
    
    let limit = params.limit.unwrap_or(8);
    
    // Use the real WikiEngine to get search suggestions from Wikipedia API
    match state.engine.suggest_terms(&params.query, limit).await {
        Ok(suggestions) => Json(ApiResponse::success(suggestions)),
        Err(e) => {
            tracing::error!("Suggestion failed for query '{}': {}", params.query, e);
            Json(ApiResponse::error(format!("Suggestion failed: {}", e)))
        }
    }
}