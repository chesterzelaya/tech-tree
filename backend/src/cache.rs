use crate::types::{AnalysisNode, EngineeringPrinciple, WikipediaPage};
use dashmap::DashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};

#[derive(Clone)]
pub struct CacheEntry<T> {
    pub data: T,
    pub timestamp: Instant,
    pub access_count: u64,
}

impl<T> CacheEntry<T> {
    pub fn new(data: T) -> Self {
        Self {
            data,
            timestamp: Instant::now(),
            access_count: 1,
        }
    }

    pub fn is_expired(&self, ttl: Duration) -> bool {
        self.timestamp.elapsed() > ttl
    }

    pub fn access(&mut self) -> &T {
        self.access_count += 1;
        &self.data
    }
}

pub struct WikiEngineCache {
    wikipedia_pages: Arc<DashMap<String, CacheEntry<WikipediaPage>>>,
    principles: Arc<DashMap<String, CacheEntry<Vec<EngineeringPrinciple>>>>,
    analysis_nodes: Arc<DashMap<String, CacheEntry<AnalysisNode>>>,
    page_ttl: Duration,
    principle_ttl: Duration,
    max_entries: usize,
}

impl WikiEngineCache {
    pub fn new() -> Self {
        Self {
            wikipedia_pages: Arc::new(DashMap::new()),
            principles: Arc::new(DashMap::new()),
            analysis_nodes: Arc::new(DashMap::new()),
            page_ttl: Duration::from_secs(3600), // 1 hour
            principle_ttl: Duration::from_secs(7200), // 2 hours
            max_entries: 1000,
        }
    }

    pub fn with_config(page_ttl: Duration, principle_ttl: Duration, max_entries: usize) -> Self {
        Self {
            wikipedia_pages: Arc::new(DashMap::new()),
            principles: Arc::new(DashMap::new()),
            analysis_nodes: Arc::new(DashMap::new()),
            page_ttl,
            principle_ttl,
            max_entries,
        }
    }

    // Wikipedia page caching
    pub fn get_wikipedia_page(&self, title: &str) -> Option<WikipediaPage> {
        if let Some(mut entry) = self.wikipedia_pages.get_mut(title) {
            if !entry.is_expired(self.page_ttl) {
                return Some(entry.access().clone());
            } else {
                // Entry expired, remove it
                drop(entry);
                self.wikipedia_pages.remove(title);
            }
        }
        None
    }

    pub fn cache_wikipedia_page(&self, title: String, page: WikipediaPage) {
        self.ensure_capacity(&self.wikipedia_pages);
        self.wikipedia_pages.insert(title, CacheEntry::new(page));
    }

    // Engineering principles caching
    pub fn get_principles(&self, page_title: &str) -> Option<Vec<EngineeringPrinciple>> {
        if let Some(mut entry) = self.principles.get_mut(page_title) {
            if !entry.is_expired(self.principle_ttl) {
                return Some(entry.access().clone());
            } else {
                drop(entry);
                self.principles.remove(page_title);
            }
        }
        None
    }

    pub fn cache_principles(&self, page_title: String, principles: Vec<EngineeringPrinciple>) {
        self.ensure_capacity(&self.principles);
        self.principles.insert(page_title, CacheEntry::new(principles));
    }

    // Analysis node caching (for recursive results)
    pub fn get_analysis_node(&self, cache_key: &str) -> Option<AnalysisNode> {
        if let Some(mut entry) = self.analysis_nodes.get_mut(cache_key) {
            if !entry.is_expired(self.principle_ttl) {
                return Some(entry.access().clone());
            } else {
                drop(entry);
                self.analysis_nodes.remove(cache_key);
            }
        }
        None
    }

    pub fn cache_analysis_node(&self, cache_key: String, node: AnalysisNode) {
        self.ensure_capacity(&self.analysis_nodes);
        self.analysis_nodes.insert(cache_key, CacheEntry::new(node));
    }

    // Generate cache key for analysis with depth and options
    pub fn generate_analysis_cache_key(&self, term: &str, max_depth: u8, max_results: u8) -> String {
        format!("analysis:{}:{}:{}", term, max_depth, max_results)
    }

    // Cache management
    fn ensure_capacity<T>(&self, cache: &Arc<DashMap<String, CacheEntry<T>>>) {
        if cache.len() >= self.max_entries {
            self.evict_oldest(cache);
        }
    }

    fn evict_oldest<T>(&self, cache: &Arc<DashMap<String, CacheEntry<T>>>) {
        let mut oldest_key: Option<String> = None;
        let mut oldest_time = Instant::now();

        // Find the oldest entry
        for entry in cache.iter() {
            if entry.timestamp < oldest_time {
                oldest_time = entry.timestamp;
                oldest_key = Some(entry.key().clone());
            }
        }

        // Remove the oldest entry
        if let Some(key) = oldest_key {
            cache.remove(&key);
        }
    }

    pub fn cleanup_expired(&self) {
        // Clean up expired Wikipedia pages
        self.cleanup_expired_entries(&self.wikipedia_pages, self.page_ttl);
        
        // Clean up expired principles
        self.cleanup_expired_entries(&self.principles, self.principle_ttl);
        
        // Clean up expired analysis nodes
        self.cleanup_expired_entries(&self.analysis_nodes, self.principle_ttl);
    }

    fn cleanup_expired_entries<T>(&self, cache: &Arc<DashMap<String, CacheEntry<T>>>, ttl: Duration) {
        let mut expired_keys = Vec::new();
        
        for entry in cache.iter() {
            if entry.is_expired(ttl) {
                expired_keys.push(entry.key().clone());
            }
        }
        
        for key in expired_keys {
            cache.remove(&key);
        }
    }

    pub fn get_cache_stats(&self) -> CacheStats {
        CacheStats {
            wikipedia_pages_count: self.wikipedia_pages.len(),
            principles_count: self.principles.len(),
            analysis_nodes_count: self.analysis_nodes.len(),
            total_memory_usage: self.estimate_memory_usage(),
        }
    }

    fn estimate_memory_usage(&self) -> usize {
        // Rough estimation of memory usage
        let pages_size = self.wikipedia_pages.len() * 1024; // Assume ~1KB per page
        let principles_size = self.principles.len() * 512; // Assume ~512B per principle set
        let nodes_size = self.analysis_nodes.len() * 2048; // Assume ~2KB per analysis node
        
        pages_size + principles_size + nodes_size
    }

    pub fn clear_all(&self) {
        self.wikipedia_pages.clear();
        self.principles.clear();
        self.analysis_nodes.clear();
    }

    pub fn warm_up(&self, common_terms: &[&str]) {
        // This method can be used to pre-populate cache with common engineering terms
        // Implementation would involve pre-fetching and analyzing common terms
        tracing::info!("Cache warm-up initiated for {} terms", common_terms.len());
    }
}

#[derive(Debug, Clone)]
pub struct CacheStats {
    pub wikipedia_pages_count: usize,
    pub principles_count: usize,
    pub analysis_nodes_count: usize,
    pub total_memory_usage: usize,
}

impl Default for WikiEngineCache {
    fn default() -> Self {
        Self::new()
    }
}

// Background cleanup task
pub async fn start_cache_cleanup_task(cache: Arc<WikiEngineCache>) {
    let mut interval = tokio::time::interval(Duration::from_secs(300)); // Clean up every 5 minutes
    
    loop {
        interval.tick().await;
        cache.cleanup_expired();
        
        let stats = cache.get_cache_stats();
        tracing::debug!(
            "Cache cleanup completed. Stats: pages={}, principles={}, nodes={}, memory={}KB",
            stats.wikipedia_pages_count,
            stats.principles_count,
            stats.analysis_nodes_count,
            stats.total_memory_usage / 1024
        );
    }
}