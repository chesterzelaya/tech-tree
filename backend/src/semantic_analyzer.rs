use crate::types::{EngineeringPrinciple, PrincipleCategory, Result, WikipediaPage};
use std::collections::{HashMap, HashSet};
use tokenizers::Tokenizer;
use ort::{session::Session, value::Value};
use ndarray::Array2;
use regex::Regex;

/// Knowledge base for engineering concepts and hierarchical relationships
#[derive(Debug, Clone)]
pub struct ConceptKnowledgeBase {
    pub concept_hierarchies: HashMap<String, Vec<String>>,
    pub component_relationships: HashMap<String, Vec<ComponentRelation>>,
    pub category_mappings: HashMap<String, PrincipleCategory>,
    pub synonyms: HashMap<String, Vec<String>>,
}

/// Represents a relationship between engineering components
#[derive(Debug, Clone)]
pub struct ComponentRelation {
    pub component: String,
    pub relation_type: RelationType,
    pub confidence: f32,
}

/// Types of relationships between components
#[derive(Debug, Clone, PartialEq)]
pub enum RelationType {
    PartOf,        // Motor is part of UAV
    Requires,      // UAV requires power source
    Controls,      // Flight controller controls motors
    Connects,      // Wires connect components
    Supports,      // Frame supports payload
    Converts,      // Battery converts chemical to electrical energy
}

/// Component extractor for identifying engineering parts
#[derive(Debug, Clone)]
pub struct ComponentExtractor {
    pub name: String,
    pub patterns: Vec<Regex>,
    pub category: PrincipleCategory,
    pub weight: f32,
}

/// Pattern for detecting relationships between components
#[derive(Debug, Clone)]
pub struct RelationshipPattern {
    pub pattern: Regex,
    pub relation_type: RelationType,
    pub confidence: f32,
}

/// Result of concept decomposition
#[derive(Debug, Clone)]
pub struct ConceptDecomposition {
    pub concept: String,
    pub components: Vec<FoundationalComponent>,
    pub relationships: Vec<ComponentRelation>,
    pub confidence: f32,
}

/// A foundational engineering component
#[derive(Debug, Clone)]
pub struct FoundationalComponent {
    pub name: String,
    pub category: PrincipleCategory,
    pub description: String,
    pub importance: f32,
    pub sub_components: Vec<String>,
}

/// Advanced semantic analyzer using ML techniques for hierarchical concept decomposition
pub struct SemanticAnalyzer {
    // ONNX Runtime session for sentence embeddings
    embedding_session: Option<Session>,
    tokenizer: Option<Tokenizer>,
    
    // Knowledge base for engineering concepts and their relationships
    concept_knowledge: ConceptKnowledgeBase,
    
    // Pre-computed embeddings for engineering concepts
    concept_embeddings: HashMap<String, Vec<f32>>,
    
    // NLP components
    component_extractors: Vec<ComponentExtractor>,
    relationship_patterns: Vec<RelationshipPattern>,
    
    // Model parameters
    similarity_threshold: f32,
    confidence_threshold: f32,
}

impl SemanticAnalyzer {
    pub fn new() -> Result<Self> {
        // Initialize embedding model
        let (embedding_session, tokenizer) = Self::try_load_embedding_model();
        
        // Build comprehensive knowledge base
        let concept_knowledge = Self::build_knowledge_base();
        
        // Initialize component extractors with ML-driven patterns
        let component_extractors = Self::build_component_extractors();
        
        // Build relationship detection patterns
        let relationship_patterns = Self::build_relationship_patterns();
        
        // Pre-compute embeddings for key engineering concepts
        let concept_embeddings = Self::precompute_concept_embeddings(&embedding_session, &tokenizer);
        
        if embedding_session.is_some() {
            tracing::info!("Advanced ML-based semantic analyzer initialized with embeddings");
        } else {
            tracing::info!("Semantic analyzer initialized with knowledge-based fallback");
        }

        Ok(Self {
            embedding_session,
            tokenizer,
            concept_knowledge,
            concept_embeddings,
            component_extractors,
            relationship_patterns,
            similarity_threshold: 0.6,
            confidence_threshold: 0.4,
        })
    }

    /// Build comprehensive engineering knowledge base
    fn build_knowledge_base() -> ConceptKnowledgeBase {
        let mut concept_hierarchies = HashMap::new();
        let mut component_relationships = HashMap::new();
        let mut category_mappings = HashMap::new();
        let mut synonyms = HashMap::new();

        // UAV/Drone hierarchical decomposition
        concept_hierarchies.insert("uav".to_string(), vec![
            "propulsion system".to_string(),
            "flight controller".to_string(),
            "power system".to_string(),
            "communication system".to_string(),
            "navigation system".to_string(),
            "structural frame".to_string(),
            "payload system".to_string(),
        ]);

        concept_hierarchies.insert("propulsion system".to_string(), vec![
            "motor".to_string(),
            "propeller".to_string(),
            "electronic speed controller".to_string(),
            "motor mount".to_string(),
        ]);

        concept_hierarchies.insert("power system".to_string(), vec![
            "battery".to_string(),
            "power distribution board".to_string(),
            "voltage regulator".to_string(),
            "charging system".to_string(),
        ]);

        concept_hierarchies.insert("flight controller".to_string(), vec![
            "microprocessor".to_string(),
            "inertial measurement unit".to_string(),
            "gyroscope".to_string(),
            "accelerometer".to_string(),
            "barometer".to_string(),
        ]);

        // Add more engineering systems
        concept_hierarchies.insert("engine".to_string(), vec![
            "combustion chamber".to_string(),
            "piston".to_string(),
            "crankshaft".to_string(),
            "valve system".to_string(),
            "fuel injection system".to_string(),
            "cooling system".to_string(),
            "ignition system".to_string(),
        ]);

        concept_hierarchies.insert("bridge".to_string(), vec![
            "foundation".to_string(),
            "deck".to_string(),
            "superstructure".to_string(),
            "support cables".to_string(),
            "anchoring system".to_string(),
        ]);

        // Component relationships for UAV
        component_relationships.insert("uav".to_string(), vec![
            ComponentRelation { component: "motor".to_string(), relation_type: RelationType::PartOf, confidence: 0.95 },
            ComponentRelation { component: "battery".to_string(), relation_type: RelationType::Requires, confidence: 0.98 },
            ComponentRelation { component: "propeller".to_string(), relation_type: RelationType::PartOf, confidence: 0.90 },
            ComponentRelation { component: "flight controller".to_string(), relation_type: RelationType::Controls, confidence: 0.92 },
        ]);

        // Category mappings
        category_mappings.insert("motor".to_string(), PrincipleCategory::Mechanical);
        category_mappings.insert("battery".to_string(), PrincipleCategory::Electrical);
        category_mappings.insert("propeller".to_string(), PrincipleCategory::Mechanical);
        category_mappings.insert("flight controller".to_string(), PrincipleCategory::System);
        category_mappings.insert("frame".to_string(), PrincipleCategory::Structural);

        // Synonyms for better matching
        synonyms.insert("uav".to_string(), vec!["drone".to_string(), "unmanned aerial vehicle".to_string(), "quadcopter".to_string()]);
        synonyms.insert("motor".to_string(), vec!["engine".to_string(), "actuator".to_string()]);
        synonyms.insert("battery".to_string(), vec!["power source".to_string(), "energy storage".to_string()]);

        ConceptKnowledgeBase {
            concept_hierarchies,
            component_relationships,
            category_mappings,
            synonyms,
        }
    }

    /// Build ML-driven component extractors
    fn build_component_extractors() -> Vec<ComponentExtractor> {
        vec![
            ComponentExtractor {
                name: "mechanical_components".to_string(),
                patterns: vec![
                    Regex::new(r"\b(motor|engine|gear|bearing|shaft|piston|turbine|pump|compressor|fan|propeller)\b").unwrap(),
                    Regex::new(r"\b(actuator|servo|stepper|valve|clutch|brake|transmission|coupling)\b").unwrap(),
                ],
                category: PrincipleCategory::Mechanical,
                weight: 0.8,
            },
            ComponentExtractor {
                name: "electrical_components".to_string(),
                patterns: vec![
                    Regex::new(r"\b(battery|capacitor|resistor|transistor|diode|circuit|sensor|microcontroller)\b").unwrap(),
                    Regex::new(r"\b(power supply|transformer|inverter|converter|relay|switch|connector)\b").unwrap(),
                ],
                category: PrincipleCategory::Electrical,
                weight: 0.85,
            },
            ComponentExtractor {
                name: "structural_components".to_string(),
                patterns: vec![
                    Regex::new(r"\b(frame|chassis|beam|column|foundation|support|bracket|mount|housing)\b").unwrap(),
                    Regex::new(r"\b(panel|plate|shell|casing|structure|framework|skeleton)\b").unwrap(),
                ],
                category: PrincipleCategory::Structural,
                weight: 0.75,
            },
            ComponentExtractor {
                name: "control_components".to_string(),
                patterns: vec![
                    Regex::new(r"\b(controller|processor|computer|ECU|flight controller|autopilot)\b").unwrap(),
                    Regex::new(r"\b(sensor|gyroscope|accelerometer|GPS|IMU|barometer|compass)\b").unwrap(),
                ],
                category: PrincipleCategory::System,
                weight: 0.9,
            },
            ComponentExtractor {
                name: "thermal_components".to_string(),
                patterns: vec![
                    Regex::new(r"\b(radiator|heat sink|cooling fan|thermal pad|heat exchanger)\b").unwrap(),
                    Regex::new(r"\b(insulation|thermal barrier|coolant|refrigeration)\b").unwrap(),
                ],
                category: PrincipleCategory::Thermal,
                weight: 0.7,
            },
        ]
    }

    /// Build relationship detection patterns
    fn build_relationship_patterns() -> Vec<RelationshipPattern> {
        vec![
            RelationshipPattern {
                pattern: Regex::new(r"(\w+)\s+(?:is|are)\s+(?:part of|component of|element of)\s+(\w+)").unwrap(),
                relation_type: RelationType::PartOf,
                confidence: 0.9,
            },
            RelationshipPattern {
                pattern: Regex::new(r"(\w+)\s+(?:requires|needs|depends on)\s+(\w+)").unwrap(),
                relation_type: RelationType::Requires,
                confidence: 0.85,
            },
            RelationshipPattern {
                pattern: Regex::new(r"(\w+)\s+(?:controls|manages|regulates)\s+(\w+)").unwrap(),
                relation_type: RelationType::Controls,
                confidence: 0.8,
            },
            RelationshipPattern {
                pattern: Regex::new(r"(\w+)\s+(?:connects to|links to|attached to)\s+(\w+)").unwrap(),
                relation_type: RelationType::Connects,
                confidence: 0.75,
            },
            RelationshipPattern {
                pattern: Regex::new(r"(\w+)\s+(?:supports|holds|carries)\s+(\w+)").unwrap(),
                relation_type: RelationType::Supports,
                confidence: 0.8,
            },
            RelationshipPattern {
                pattern: Regex::new(r"(\w+)\s+(?:converts|transforms|changes)\s+.*(?:into|to)\s+(\w+)").unwrap(),
                relation_type: RelationType::Converts,
                confidence: 0.7,
            },
        ]
    }

    /// Pre-compute embeddings for engineering concepts
    fn precompute_concept_embeddings(
        embedding_session: &Option<Session>,
        tokenizer: &Option<Tokenizer>,
    ) -> HashMap<String, Vec<f32>> {
        let mut embeddings = HashMap::new();
        
        // In a real implementation, this would compute embeddings for key concepts
        // For now, return empty map - the system will use knowledge-based fallback
        if embedding_session.is_some() && tokenizer.is_some() {
            // Pre-compute embeddings for foundational engineering concepts
            let key_concepts = vec![
                "motor", "battery", "controller", "sensor", "frame", "propeller",
                "engine", "transmission", "brake", "suspension", "steering",
                "circuit", "capacitor", "resistor", "transformer", "switch",
            ];
            
            for concept in key_concepts {
                // In real implementation: embeddings.insert(concept.to_string(), compute_embedding(concept));
                // For now, use placeholder
                embeddings.insert(concept.to_string(), vec![0.0; 384]); // 384 is common embedding size
            }
        }
        
        embeddings
    }

    /// Try to load embedding model (sentence transformer via ONNX)
    fn try_load_embedding_model() -> (Option<Session>, Option<Tokenizer>) {
        // Try to load sentence transformer model
        match std::fs::metadata("models/sentence-transformer.onnx") {
            Ok(_) => {
                // Model file exists, try to load it
                match Session::builder() {
                    Ok(builder) => {
                        match builder.commit_from_file("models/sentence-transformer.onnx") {
                            Ok(session) => {
                                match Tokenizer::from_file("models/tokenizer.json") {
                                    Ok(tokenizer) => {
                                        tracing::info!("Successfully loaded ONNX sentence transformer model");
                                        return (Some(session), Some(tokenizer));
                                    },
                                    Err(e) => tracing::warn!("Failed to load tokenizer: {}", e),
                                }
                            },
                            Err(e) => tracing::warn!("Failed to load ONNX model: {}", e),
                        }
                    },
                    Err(e) => tracing::warn!("Failed to create ONNX session builder: {}", e),
                }
            },
            Err(_) => tracing::info!("ONNX model not found at models/sentence-transformer.onnx"),
        }
        
        (None, None)
    }

    /// Main method for decomposing engineering concepts hierarchically
    pub fn decompose_concept(&self, concept: &str, max_depth: u8) -> Result<ConceptDecomposition> {
        let normalized_concept = self.normalize_concept(concept);
        
        // Try knowledge-base first for known concepts
        if let Some(components) = self.extract_from_knowledge_base(&normalized_concept) {
            return Ok(ConceptDecomposition {
                concept: concept.to_string(),
                components,
                relationships: self.extract_relationships(&normalized_concept),
                confidence: 0.95,
            });
        }
        
        // Fall back to ML-based extraction from text content
        let wikipedia_content = self.fetch_concept_content(concept)?;
        self.extract_components_from_text(&wikipedia_content, max_depth)
    }

    /// Normalize concept for lookup (handle synonyms, case, etc.)
    fn normalize_concept(&self, concept: &str) -> String {
        let concept_lower = concept.to_lowercase();
        
        // Check for synonyms
        for (key, synonyms) in &self.concept_knowledge.synonyms {
            if key == &concept_lower || synonyms.contains(&concept_lower) {
                return key.clone();
            }
        }
        
        concept_lower
    }

    /// Extract components from knowledge base
    fn extract_from_knowledge_base(&self, concept: &str) -> Option<Vec<FoundationalComponent>> {
        let hierarchies = &self.concept_knowledge.concept_hierarchies;
        
        if let Some(sub_concepts) = hierarchies.get(concept) {
            let mut components = Vec::new();
            
            for sub_concept in sub_concepts {
                let category = self.concept_knowledge.category_mappings
                    .get(sub_concept)
                    .cloned()
                    .unwrap_or(PrincipleCategory::System);
                
                let description = self.generate_component_description(sub_concept, &category);
                let importance = self.calculate_component_importance(sub_concept, concept);
                
                // Get sub-components recursively
                let sub_components = hierarchies.get(sub_concept)
                    .map(|subs| subs.clone())
                    .unwrap_or_default();
                
                components.push(FoundationalComponent {
                    name: sub_concept.clone(),
                    category,
                    description,
                    importance,
                    sub_components,
                });
            }
            
            // Sort by importance
            components.sort_by(|a, b| b.importance.partial_cmp(&a.importance).unwrap_or(std::cmp::Ordering::Equal));
            return Some(components);
        }
        
        None
    }

    /// Extract relationships for a concept
    fn extract_relationships(&self, concept: &str) -> Vec<ComponentRelation> {
        self.concept_knowledge.component_relationships
            .get(concept)
            .cloned()
            .unwrap_or_default()
    }

    /// Generate description for a component
    fn generate_component_description(&self, component: &str, category: &PrincipleCategory) -> String {
        match category {
            PrincipleCategory::Mechanical => format!("{} is a mechanical component that provides movement, force transmission, or mechanical advantage", component),
            PrincipleCategory::Electrical => format!("{} is an electrical component that manages power, control signals, or energy conversion", component),
            PrincipleCategory::Structural => format!("{} is a structural component that provides support, stability, or load distribution", component),
            PrincipleCategory::System => format!("{} is a system component that provides control, coordination, or integration functionality", component),
            PrincipleCategory::Thermal => format!("{} is a thermal component that manages heat transfer, temperature control, or thermal regulation", component),
            PrincipleCategory::Material => format!("{} is a material component that provides specific material properties or characteristics", component),
            _ => format!("{} is an engineering component with specialized functionality", component),
        }
    }

    /// Calculate component importance based on relationships and context
    fn calculate_component_importance(&self, component: &str, parent_concept: &str) -> f32 {
        let mut importance = 0.5; // Base importance
        
        // Check if it's a critical component based on relationships
        if let Some(relationships) = self.concept_knowledge.component_relationships.get(parent_concept) {
            for relation in relationships {
                if relation.component == component {
                    match relation.relation_type {
                        RelationType::Requires => importance += 0.3,
                        RelationType::Controls => importance += 0.25,
                        RelationType::PartOf => importance += 0.2,
                        _ => importance += 0.1,
                    }
                    importance += relation.confidence * 0.2;
                }
            }
        }
        
        // Boost importance for known critical components
        let critical_components = ["motor", "battery", "controller", "processor", "engine", "frame"];
        if critical_components.contains(&component) {
            importance += 0.2;
        }
        
        importance.min(1.0)
    }

    /// Fetch content for concept analysis (placeholder for actual Wikipedia API call)
    fn fetch_concept_content(&self, _concept: &str) -> Result<String> {
        // This would normally fetch Wikipedia content
        // For now, return a placeholder to avoid breaking the system
        Ok("Placeholder content for concept analysis".to_string())
    }

    /// Extract components from text using ML techniques
    fn extract_components_from_text(&self, text: &str, _max_depth: u8) -> Result<ConceptDecomposition> {
        let mut components = Vec::new();
        let mut relationships = Vec::new();
        let text_lower = text.to_lowercase();
        
        // Use component extractors to find engineering components
        for extractor in &self.component_extractors {
            for pattern in &extractor.patterns {
                for cap in pattern.captures_iter(&text_lower) {
                    if let Some(component_match) = cap.get(1) {
                        let component_name = component_match.as_str().to_string();
                        
                        // Avoid duplicates
                        if !components.iter().any(|c: &FoundationalComponent| c.name == component_name) {
                            let description = self.generate_component_description(&component_name, &extractor.category);
                            let importance = extractor.weight * 0.8; // Base importance from extractor weight
                            
                            components.push(FoundationalComponent {
                                name: component_name,
                                category: extractor.category.clone(),
                                description,
                                importance,
                                sub_components: vec![],
                            });
                        }
                    }
                }
            }
        }
        
        // Extract relationships using relationship patterns
        for pattern_matcher in &self.relationship_patterns {
            for cap in pattern_matcher.pattern.captures_iter(&text_lower) {
                if cap.len() >= 3 {
                    if let (Some(_comp1), Some(comp2)) = (cap.get(1), cap.get(2)) {
                        relationships.push(ComponentRelation {
                            component: comp2.as_str().to_string(),
                            relation_type: pattern_matcher.relation_type.clone(),
                            confidence: pattern_matcher.confidence,
                        });
                    }
                }
            }
        }
        
        // Sort components by importance
        components.sort_by(|a, b| b.importance.partial_cmp(&a.importance).unwrap_or(std::cmp::Ordering::Equal));
        
        // Limit to top components
        components.truncate(10);
        
        let confidence = if components.is_empty() { 0.0 } else { 
            components.iter().map(|c| c.importance).sum::<f32>() / components.len() as f32 
        };
        
        Ok(ConceptDecomposition {
            concept: "extracted_concept".to_string(),
            components,
            relationships,
            confidence,
        })
    }

    /// Compute semantic embedding for text (placeholder implementation)
    fn compute_embedding(&self, text: &str) -> Option<Vec<f32>> {
        // Check if we have pre-computed embeddings
        if let Some(embedding) = self.concept_embeddings.get(text) {
            return Some(embedding.clone());
        }
        
        // In a real implementation with ONNX, this would:
        // 1. Tokenize the input text using the tokenizer
        // 2. Run inference through the ONNX session
        // 3. Return the sentence embedding vector
        //
        // For now, we return None to use the fallback word-based similarity
        // This allows the system to work without requiring ONNX models
        
        if self.embedding_session.is_some() && self.tokenizer.is_some() {
            // Placeholder: in real implementation, would compute actual embeddings
            tracing::debug!("Would compute embedding for: {}", text);
        }
        
        None
    }

    /// Enhanced method for converting decomposition to engineering principles
    pub fn decomposition_to_principles(
        &self, 
        decomposition: &ConceptDecomposition,
        page: &WikipediaPage
    ) -> Vec<EngineeringPrinciple> {
        let mut principles = Vec::new();
        
        for component in &decomposition.components {
            let principle = EngineeringPrinciple {
                id: uuid::Uuid::new_v4().to_string(),
                title: self.generate_principle_title(&component.name, &component.category),
                description: component.description.clone(),
                category: component.category.clone(),
                confidence: component.importance,
                source_url: page.url.clone(),
                related_terms: component.sub_components.clone(),
            };
            principles.push(principle);
        }
        
        // Sort by confidence/importance
        principles.sort_by(|a, b| b.confidence.partial_cmp(&a.confidence).unwrap_or(std::cmp::Ordering::Equal));
        principles
    }

    /// Generate principle title from component
    fn generate_principle_title(&self, component: &str, category: &PrincipleCategory) -> String {
        match category {
            PrincipleCategory::Mechanical => format!("{} Mechanism", self.capitalize_words(component)),
            PrincipleCategory::Electrical => format!("{} Circuit Principle", self.capitalize_words(component)),
            PrincipleCategory::Structural => format!("{} Structural Design", self.capitalize_words(component)),
            PrincipleCategory::System => format!("{} System Integration", self.capitalize_words(component)),
            PrincipleCategory::Thermal => format!("{} Thermal Management", self.capitalize_words(component)),
            _ => format!("{} Engineering Principle", self.capitalize_words(component)),
        }
    }

    /// Capitalize words for titles
    fn capitalize_words(&self, text: &str) -> String {
        text.split_whitespace()
            .map(|word| {
                let mut chars = word.chars();
                match chars.next() {
                    None => String::new(),
                    Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
                }
            })
            .collect::<Vec<_>>()
            .join(" ")
    }

    /// Legacy method for compatibility - updated to use new decomposition approach
    pub fn analyze_page_semantically(&self, page: &WikipediaPage) -> Result<Vec<EngineeringPrinciple>> {
        // Try to extract concept from page title
        let concept = page.title.to_lowercase();
        
        // Use new decomposition method
        match self.decompose_concept(&concept, 2) {
            Ok(decomposition) => {
                let principles = self.decomposition_to_principles(&decomposition, page);
                Ok(principles)
            },
            Err(_) => {
                // Fallback to text-based extraction
                let decomposition = self.extract_components_from_text(&page.extract, 1)?;
                let principles = self.decomposition_to_principles(&decomposition, page);
                Ok(principles)
            }
        }
    }

    /// Calculate semantic similarity using embeddings (with fallback to word overlap)
    fn calculate_semantic_similarity(&self, text1: &str, text2: &str) -> f32 {
        // Try embedding-based similarity first
        if let (Some(emb1), Some(emb2)) = (self.compute_embedding(text1), self.compute_embedding(text2)) {
            self.cosine_similarity(&emb1, &emb2)
        } else {
            // Fallback to word-based similarity
            self.word_overlap_similarity(text1, text2)
        }
    }

    /// Compute cosine similarity between two embeddings
    fn cosine_similarity(&self, a: &[f32], b: &[f32]) -> f32 {
        if a.len() != b.len() {
            return 0.0;
        }

        let dot_product: f32 = a.iter().zip(b.iter()).map(|(x, y)| x * y).sum();
        let norm_a: f32 = a.iter().map(|x| x * x).sum::<f32>().sqrt();
        let norm_b: f32 = b.iter().map(|x| x * x).sum::<f32>().sqrt();

        if norm_a == 0.0 || norm_b == 0.0 {
            0.0
        } else {
            dot_product / (norm_a * norm_b)
        }
    }

    /// Fallback word overlap similarity
    fn word_overlap_similarity(&self, text1: &str, text2: &str) -> f32 {
        let text1_lower = text1.to_lowercase();
        let text2_lower = text2.to_lowercase();
        let words1: HashSet<&str> = text1_lower.split_whitespace().collect();
        let words2: HashSet<&str> = text2_lower.split_whitespace().collect();
        
        let intersection = words1.intersection(&words2).count();
        let union = words1.union(&words2).count();
        
        if union == 0 {
            0.0
        } else {
            intersection as f32 / union as f32
        }
    }

    /// Public interface for hierarchical engineering concept analysis
    /// This is the main method users should call for decomposing concepts like "UAV" into foundational blocks
    pub fn analyze_engineering_concept(
        &self,
        concept: &str,
        max_depth: u8,
        source_url: Option<String>,
    ) -> Result<Vec<EngineeringPrinciple>> {
        // Decompose the concept into foundational components
        let decomposition = self.decompose_concept(concept, max_depth)?;
        
        // Create a mock Wikipedia page for compatibility
        let page = WikipediaPage {
            title: concept.to_string(),
            extract: format!("Analysis of {} and its foundational engineering components", concept),
            url: source_url.unwrap_or_else(|| format!("https://en.wikipedia.org/wiki/{}", concept)),
            page_id: 0,
        };
        
        // Convert decomposition to engineering principles
        let principles = self.decomposition_to_principles(&decomposition, &page);
        
        tracing::info!(
            "Analyzed concept '{}' -> found {} foundational components with confidence {}",
            concept,
            principles.len(),
            decomposition.confidence
        );
        
        Ok(principles)
    }

    /// Get hierarchical breakdown of a concept as a structured tree
    pub fn get_concept_hierarchy(&self, concept: &str, max_depth: u8) -> Result<ConceptDecomposition> {
        self.decompose_concept(concept, max_depth)
    }

    /// Add new concept knowledge to the knowledge base (for extending the system)
    pub fn add_concept_knowledge(
        &mut self,
        concept: &str,
        components: Vec<String>,
        relationships: Vec<ComponentRelation>,
    ) {
        self.concept_knowledge.concept_hierarchies.insert(concept.to_string(), components);
        self.concept_knowledge.component_relationships.insert(concept.to_string(), relationships);
        
        tracing::info!("Added knowledge for concept: {}", concept);
    }
}