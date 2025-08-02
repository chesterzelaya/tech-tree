use crate::cache::WikiEngineCache;
use crate::types::{AnalysisResult, SearchRequest, Result};
use crate::WikiEngine;
use axum::{
    extract::{Query, State},
    http::StatusCode,
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

pub fn create_router() -> Result<Router> {
    let router = Router::new()
        .route("/health", get(health_check))
        .route("/analyze", post(analyze_term))
        .route("/suggest", get(suggest_terms))
        .layer(CorsLayer::permissive());
    
    Ok(router)
}

pub async fn health_check() -> Json<ApiResponse<HashMap<String, String>>> {
    let mut health_data = HashMap::new();
    health_data.insert("status".to_string(), "healthy".to_string());
    health_data.insert("service".to_string(), "wiki-engine-backend".to_string());
    health_data.insert("version".to_string(), env!("CARGO_PKG_VERSION").to_string());
    
    Json(ApiResponse::success(health_data))
}

pub async fn analyze_term() -> Json<ApiResponse<AnalysisResult>> {
    // Mock response that matches the expected structure
    tracing::info!("Analysis endpoint called");
    
    use crate::types::{AnalysisResult, AnalysisNode, EngineeringPrinciple, PrincipleCategory};
    use std::collections::HashMap;
    
    let mock_principle = EngineeringPrinciple {
        id: "mock-1".to_string(),
        title: "Structural Load Distribution".to_string(),
        description: "Bridges distribute loads through their structural elements to safely transfer forces from the deck to the foundations.".to_string(),
        category: PrincipleCategory::Structural,
        confidence: 0.85,
        source_url: "https://en.wikipedia.org/wiki/Bridge".to_string(),
        related_terms: vec!["load".to_string(), "structure".to_string(), "foundation".to_string()],
    };
    
    let mock_child_principle = EngineeringPrinciple {
        id: "mock-2".to_string(),
        title: "Material Strength".to_string(),
        description: "Steel and concrete provide the necessary strength to resist tension and compression forces.".to_string(),
        category: PrincipleCategory::Material,
        confidence: 0.78,
        source_url: "https://en.wikipedia.org/wiki/Steel".to_string(),
        related_terms: vec!["steel".to_string(), "concrete".to_string(), "strength".to_string()],
    };
    
    let mut child_children = HashMap::new();
    let child_node = AnalysisNode {
        term: "steel".to_string(),
        principles: vec![mock_child_principle],
        children: child_children,
        depth: 1,
        processing_time_ms: 45,
    };
    
    let mut children = HashMap::new();
    children.insert("steel".to_string(), Box::new(child_node));
    
    let root_node = AnalysisNode {
        term: "bridge".to_string(),
        principles: vec![mock_principle],
        children,
        depth: 0,
        processing_time_ms: 120,
    };
    
    let mock_result = AnalysisResult {
        root_term: "bridge".to_string(),
        tree: root_node,
        total_processing_time_ms: 165,
        total_principles: 2,
        max_depth_reached: 1,
    };
    
    Json(ApiResponse::success(mock_result))
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

pub async fn suggest_terms() -> Json<ApiResponse<Vec<SearchSuggestion>>> {
    // Simplified handler for now - will be expanded later
    tracing::info!("Suggest endpoint called");
    let mock_suggestions = vec![
        SearchSuggestion {
            term: "bridge".to_string(),
            confidence: 0.9,
            category: "Structural".to_string(),
        },
        SearchSuggestion {
            term: "engine".to_string(),
            confidence: 0.8,
            category: "Mechanical".to_string(),
        },
    ];
    Json(ApiResponse::success(mock_suggestions))
}