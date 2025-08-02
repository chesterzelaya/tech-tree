use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchRequest {
    pub term: String,
    pub max_depth: Option<u8>,
    pub max_results: Option<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EngineeringPrinciple {
    pub id: String,
    pub title: String,
    pub description: String,
    pub category: PrincipleCategory,
    pub confidence: f32,
    pub source_url: String,
    pub related_terms: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum PrincipleCategory {
    Structural,
    Mechanical,
    Electrical,
    Thermal,
    Chemical,
    Material,
    System,
    Process,
    Design,
    Other(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalysisNode {
    pub term: String,
    pub principles: Vec<EngineeringPrinciple>,
    pub children: HashMap<String, Box<AnalysisNode>>,
    pub depth: u8,
    pub processing_time_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalysisResult {
    pub root_term: String,
    pub tree: AnalysisNode,
    pub total_processing_time_ms: u64,
    pub total_principles: u32,
    pub max_depth_reached: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WikipediaPage {
    pub title: String,
    pub extract: String,
    pub url: String,
    pub page_id: u64,
}

#[derive(Debug, thiserror::Error)]
pub enum WikiEngineError {
    #[error("Wikipedia API error: {0}")]
    WikipediaApi(String),
    #[error("Analysis error: {0}")]
    Analysis(String),
    #[error("Network error: {0}")]
    Network(#[from] reqwest::Error),
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
}

pub type Result<T> = std::result::Result<T, WikiEngineError>;