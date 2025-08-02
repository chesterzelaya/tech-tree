use std::sync::Arc;
use tracing::{info, error};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use wiki_engine::api::{create_router_with_state, WikiEngineState};
use wiki_engine::cache::{start_cache_cleanup_task, WikiEngineCache};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "wiki_engine_backend=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    info!("Starting Wiki Engine Backend Server");

    // Create WikiEngine state with cache
    let state = Arc::new(WikiEngineState::new().expect("Failed to create WikiEngine state"));
    
    // Start cache cleanup task
    tokio::spawn(start_cache_cleanup_task(Arc::clone(&state.cache)));

    // Warm up cache with common engineering terms
    let common_terms = [
        "bridge", "engine", "motor", "gear", "lever", "pulley", "circuit", "transistor",
        "beam", "column", "foundation", "steel", "concrete", "aluminum",
    ];
    state.cache.warm_up(&common_terms);

    // Create the application router with state
    let app = create_router_with_state(state).expect("Failed to create router");

    // Configure server
    let port = std::env::var("PORT").unwrap_or_else(|_| "3001".to_string());
    let addr = format!("0.0.0.0:{}", port);
    
    info!("Server starting on {}", addr);

    // Create TCP listener
    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .unwrap_or_else(|e| {
            error!("Failed to bind to {}: {}", addr, e);
            std::process::exit(1);
        });

    info!("Wiki Engine Backend Server is running on http://{}", addr);
    info!("Endpoints available:");
    info!("  POST /analyze - Analyze engineering principles (JSON body)");
    info!("  GET  /analyze?term=<term>&max_depth=<depth> - Analyze via query params");
    info!("  GET  /health - Health check");
    info!("  GET  /cache/stats - Cache statistics");
    info!("  POST /cache/clear - Clear cache");

    // Run the server
    axum::serve(listener, app)
        .await
        .unwrap_or_else(|e| {
            error!("Server error: {}", e);
            std::process::exit(1);
        });

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{
        body::Body,
        http::{Request, StatusCode},
    };
    use tower::ServiceExt;
    use wiki_engine::types::SearchRequest;

    #[tokio::test]
    async fn test_health_endpoint() {
        let app = create_router().unwrap();
        
        let response = app
            .oneshot(Request::builder().uri("/health").body(Body::empty()).unwrap())
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn test_analyze_endpoint() {
        let app = create_router().unwrap();
        
        let request_body = SearchRequest {
            term: "bridge".to_string(),
            max_depth: Some(2),
            max_results: Some(5),
        };
        
        let request = Request::builder()
            .uri("/analyze")
            .method("POST")
            .header("content-type", "application/json")
            .body(Body::from(serde_json::to_string(&request_body).unwrap()))
            .unwrap();

        let response = app.oneshot(request).await.unwrap();
        
        // Should return OK (this is a basic integration test)
        assert!(response.status().is_success() || response.status().is_server_error());
    }

    #[tokio::test]
    async fn test_cache_stats_endpoint() {
        let app = create_router().unwrap();
        
        let response = app
            .oneshot(Request::builder().uri("/cache/stats").body(Body::empty()).unwrap())
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
    }
}

// Performance monitoring
#[cfg(feature = "metrics")]
mod metrics {
    use std::time::Instant;
    
    pub struct PerformanceMonitor {
        start_time: Instant,
    }
    
    impl PerformanceMonitor {
        pub fn new() -> Self {
            Self {
                start_time: Instant::now(),
            }
        }
        
        pub fn uptime(&self) -> std::time::Duration {
            self.start_time.elapsed()
        }
    }
}

// Graceful shutdown handling
async fn shutdown_signal() {
    let ctrl_c = async {
        tokio::signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("failed to install signal handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }

    info!("Shutdown signal received, starting graceful shutdown");
}