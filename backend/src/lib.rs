pub mod types;
pub mod wikipedia;
pub mod analyzer;
pub mod cache;
pub mod api;

use crate::analyzer::EngineeringAnalyzer;
use crate::cache::WikiEngineCache;
use crate::types::{AnalysisNode, AnalysisResult, EngineeringPrinciple, SearchRequest, Result, WikiEngineError};
use crate::wikipedia::WikipediaClient;
use std::collections::{HashMap, HashSet};
use std::sync::{Arc, Mutex};
use std::time::Instant;

pub struct WikiEngine {
    wikipedia_client: WikipediaClient,
    analyzer: EngineeringAnalyzer,
    cache: Arc<WikiEngineCache>,
}

impl WikiEngine {
    pub fn new(cache: Arc<WikiEngineCache>) -> Result<Self> {
        Ok(Self {
            wikipedia_client: WikipediaClient::new(),
            analyzer: EngineeringAnalyzer::new()?,
            cache,
        })
    }

    pub async fn analyze_recursive(&self, request: &SearchRequest) -> Result<AnalysisResult> {
        let start_time = Instant::now();
        let max_depth = request.max_depth.unwrap_or(3);
        let max_results = request.max_results.unwrap_or(10);

        tracing::info!(
            "Starting recursive analysis for '{}' (max_depth={}, max_results={})",
            request.term, max_depth, max_results
        );

        // Check cache first
        let cache_key = self.cache.generate_analysis_cache_key(&request.term, max_depth, max_results);
        if let Some(cached_node) = self.cache.get_analysis_node(&cache_key) {
            tracing::info!("Returning cached analysis for '{}'", request.term);
            return Ok(AnalysisResult {
                root_term: request.term.clone(),
                tree: cached_node.clone(),
                total_processing_time_ms: start_time.elapsed().as_millis() as u64,
                total_principles: Self::count_principles(&cached_node),
                max_depth_reached: Self::calculate_max_depth(&cached_node),
            });
        }

        // Perform recursive analysis
        let visited = Arc::new(Mutex::new(HashSet::new()));
        let root_node = self.analyze_term_recursive(
            &request.term,
            0,
            max_depth,
            max_results,
            visited,
        ).await?;

        let total_processing_time = start_time.elapsed().as_millis() as u64;
        let total_principles = Self::count_principles(&root_node);
        let max_depth_reached = Self::calculate_max_depth(&root_node);

        // Cache the result
        self.cache.cache_analysis_node(cache_key, root_node.clone());

        let result = AnalysisResult {
            root_term: request.term.clone(),
            tree: root_node,
            total_processing_time_ms: total_processing_time,
            total_principles,
            max_depth_reached,
        };

        tracing::info!(
            "Completed recursive analysis for '{}': {} principles, {}ms, max_depth={}",
            request.term, total_principles, total_processing_time, max_depth_reached
        );

        Ok(result)
    }

    fn analyze_term_recursive<'a>(
        &'a self,
        term: &'a str,
        current_depth: u8,
        max_depth: u8,
        max_results: u8,
        visited: Arc<Mutex<HashSet<String>>>,
    ) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<AnalysisNode>> + Send + 'a>> {
        Box::pin(async move {
        let term_start = Instant::now();
        
        // Prevent infinite recursion
        {
            let visited_lock = visited.lock().unwrap();
            if visited_lock.contains(term) || current_depth >= max_depth {
                return Ok(AnalysisNode {
                    term: term.to_string(),
                    principles: vec![],
                    children: HashMap::new(),
                    depth: current_depth,
                    processing_time_ms: term_start.elapsed().as_millis() as u64,
                });
            }
        }

        visited.lock().unwrap().insert(term.to_string());
        tracing::debug!("Analyzing term '{}' at depth {}", term, current_depth);

        // Get Wikipedia page
        let page = match self.get_or_fetch_page(term).await? {
            Some(page) => page,
            None => {
                tracing::warn!("No Wikipedia page found for '{}'", term);
                return Ok(AnalysisNode {
                    term: term.to_string(),
                    principles: vec![],
                    children: HashMap::new(),
                    depth: current_depth,
                    processing_time_ms: term_start.elapsed().as_millis() as u64,
                });
            }
        };

        // Analyze the page for engineering principles
        let principles = self.get_or_analyze_principles(&page).await?;

        // Extract related concepts for recursive analysis
        let related_concepts = if current_depth < max_depth {
            self.analyzer.extract_related_concepts(&page)
        } else {
            vec![]
        };

        // Recursively analyze related concepts
        let mut children = HashMap::new();
        let concepts_to_analyze = related_concepts.into_iter()
            .take(max_results as usize)
            .collect::<Vec<_>>();

        for concept in concepts_to_analyze {
            let should_analyze = {
                let visited_lock = visited.lock().unwrap();
                !visited_lock.contains(&concept) && concept != term
            };
            
            if should_analyze {
                match self.analyze_term_recursive(
                    &concept,
                    current_depth + 1,
                    max_depth,
                    max_results,
                    Arc::clone(&visited),
                ).await {
                    Ok(child_node) => {
                        children.insert(concept.clone(), Box::new(child_node));
                    }
                    Err(e) => {
                        tracing::warn!("Failed to analyze related concept '{}': {}", concept, e);
                    }
                }
            }
        }

        visited.lock().unwrap().remove(term);

        Ok(AnalysisNode {
            term: term.to_string(),
            principles,
            children,
            depth: current_depth,
            processing_time_ms: term_start.elapsed().as_millis() as u64,
        })
        })
    }

    async fn get_or_fetch_page(&self, term: &str) -> Result<Option<crate::types::WikipediaPage>> {
        // Check cache first
        if let Some(cached_page) = self.cache.get_wikipedia_page(term) {
            tracing::debug!("Using cached Wikipedia page for '{}'", term);
            return Ok(Some(cached_page));
        }

        // Fetch from Wikipedia
        tracing::debug!("Fetching Wikipedia page for '{}'", term);
        match self.wikipedia_client.get_page_extract(term).await? {
            Some(page) => {
                self.cache.cache_wikipedia_page(term.to_string(), page.clone());
                Ok(Some(page))
            }
            None => Ok(None),
        }
    }

    async fn get_or_analyze_principles(
        &self,
        page: &crate::types::WikipediaPage,
    ) -> Result<Vec<EngineeringPrinciple>> {
        // Check cache first
        if let Some(cached_principles) = self.cache.get_principles(&page.title) {
            tracing::debug!("Using cached principles for '{}'", page.title);
            return Ok(cached_principles);
        }

        // Analyze the page
        tracing::debug!("Analyzing principles for '{}'", page.title);
        let principles = self.analyzer.analyze_page(page)?;
        
        // Cache the results
        self.cache.cache_principles(page.title.clone(), principles.clone());
        
        Ok(principles)
    }

    pub async fn suggest_terms(&self, query: &str, limit: u8) -> Result<Vec<crate::api::SearchSuggestion>> {
        let search_results = self.wikipedia_client.search_pages(query, limit).await?;
        
        let mut suggestions = Vec::new();
        for title in search_results {
            // Simple heuristic for engineering relevance
            let confidence = self.calculate_engineering_relevance(&title);
            let category = self.infer_category_from_title(&title);
            
            suggestions.push(crate::api::SearchSuggestion {
                term: title,
                confidence,
                category,
            });
        }

        // Sort by confidence
        suggestions.sort_by(|a, b| b.confidence.partial_cmp(&a.confidence).unwrap());
        suggestions.truncate(limit as usize);
        
        Ok(suggestions)
    }

    fn calculate_engineering_relevance(&self, title: &str) -> f32 {
        let engineering_keywords = [
            "engine", "motor", "system", "design", "structure", "material", "process",
            "machine", "device", "technology", "mechanism", "circuit", "bridge", "building",
            "manufacturing", "engineering", "mechanical", "electrical", "chemical", "civil",
        ];

        let title_lower = title.to_lowercase();
        let mut score: f32 = 0.0;

        for keyword in &engineering_keywords {
            if title_lower.contains(keyword) {
                score += 0.2;
            }
        }

        // Bonus for longer, more specific titles
        if title.len() > 10 {
            score += 0.1;
        }

        score.min(1.0)
    }

    fn infer_category_from_title(&self, title: &str) -> String {
        let title_lower = title.to_lowercase();
        
        if title_lower.contains("bridge") || title_lower.contains("building") || title_lower.contains("structure") {
            "Structural".to_string()
        } else if title_lower.contains("engine") || title_lower.contains("motor") || title_lower.contains("gear") {
            "Mechanical".to_string()
        } else if title_lower.contains("circuit") || title_lower.contains("electronic") || title_lower.contains("electrical") {
            "Electrical".to_string()
        } else if title_lower.contains("material") || title_lower.contains("steel") || title_lower.contains("composite") {
            "Material".to_string()
        } else if title_lower.contains("process") || title_lower.contains("manufacturing") {
            "Process".to_string()
        } else {
            "General".to_string()
        }
    }

    fn count_principles(node: &AnalysisNode) -> u32 {
        let mut count = node.principles.len() as u32;
        for child in node.children.values() {
            count += Self::count_principles(child);
        }
        count
    }

    fn calculate_max_depth(node: &AnalysisNode) -> u8 {
        let mut max_depth = node.depth;
        for child in node.children.values() {
            max_depth = max_depth.max(Self::calculate_max_depth(child));
        }
        max_depth
    }

    pub async fn batch_analyze(&self, terms: &[String], max_depth: u8) -> Result<Vec<AnalysisResult>> {
        let mut results = Vec::new();
        
        for term in terms {
            let request = SearchRequest {
                term: term.clone(),
                max_depth: Some(max_depth),
                max_results: Some(5), // Smaller for batch processing
            };
            
            match self.analyze_recursive(&request).await {
                Ok(result) => results.push(result),
                Err(e) => tracing::error!("Batch analysis failed for '{}': {}", term, e),
            }
        }
        
        Ok(results)
    }

    pub fn get_cache_reference(&self) -> Arc<WikiEngineCache> {
        Arc::clone(&self.cache)
    }
}

// WASM support
#[cfg(target_arch = "wasm32")]
mod wasm {
    use super::*;
    use wasm_bindgen::prelude::*;
    
    #[wasm_bindgen]
    pub struct WasmWikiEngine {
        engine: WikiEngine,
    }
    
    #[wasm_bindgen]
    impl WasmWikiEngine {
        #[wasm_bindgen(constructor)]
        pub fn new() -> Result<WasmWikiEngine, JsValue> {
            let cache = Arc::new(WikiEngineCache::new());
            let engine = WikiEngine::new(cache)
                .map_err(|e| JsValue::from_str(&e.to_string()))?;
                
            Ok(WasmWikiEngine { engine })
        }
        
        #[wasm_bindgen]
        pub async fn analyze(&self, term: String, max_depth: Option<u8>) -> Result<JsValue, JsValue> {
            let request = SearchRequest {
                term,
                max_depth,
                max_results: Some(10),
            };
            
            let result = self.engine.analyze_recursive(&request).await
                .map_err(|e| JsValue::from_str(&e.to_string()))?;
                
            serde_wasm_bindgen::to_value(&result)
                .map_err(|e| JsValue::from_str(&e.to_string()))
        }
    }
}