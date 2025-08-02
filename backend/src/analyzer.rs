use crate::types::{EngineeringPrinciple, PrincipleCategory, Result, WikiEngineError, WikipediaPage};
use regex::Regex;
use std::collections::{HashMap, HashSet};

pub struct EngineeringAnalyzer {
    structural_patterns: Vec<Regex>,
    mechanical_patterns: Vec<Regex>,
    electrical_patterns: Vec<Regex>,
    thermal_patterns: Vec<Regex>,
    chemical_patterns: Vec<Regex>,
    material_patterns: Vec<Regex>,
    system_patterns: Vec<Regex>,
    process_patterns: Vec<Regex>,
    design_patterns: Vec<Regex>,
    principle_extractors: Vec<Regex>,
    related_term_extractors: Vec<Regex>,
}

impl EngineeringAnalyzer {
    pub fn new() -> Result<Self> {
        Ok(Self {
            structural_patterns: Self::compile_patterns(&[
                r"(?i)(load|stress|strain|tension|compression|shear|moment|deflection)",
                r"(?i)(beam|column|truss|frame|foundation|support)",
                r"(?i)(buckling|fatigue|failure|strength|stiffness)",
                r"(?i)(structural\s+integrity|bearing\s+capacity|factor\s+of\s+safety)",
            ])?,
            mechanical_patterns: Self::compile_patterns(&[
                r"(?i)(force|torque|power|energy|motion|velocity|acceleration)",
                r"(?i)(gear|lever|pulley|spring|damper|actuator)",
                r"(?i)(friction|lubrication|wear|vibration|resonance)",
                r"(?i)(mechanical\s+advantage|efficiency|work|momentum)",
            ])?,
            electrical_patterns: Self::compile_patterns(&[
                r"(?i)(voltage|current|resistance|capacitance|inductance)",
                r"(?i)(circuit|conductor|insulator|semiconductor|transistor)",
                r"(?i)(electric\s+field|magnetic\s+field|electromagnetic)",
                r"(?i)(ohm's\s+law|kirchhoff|maxwell|faraday)",
            ])?,
            thermal_patterns: Self::compile_patterns(&[
                r"(?i)(heat|temperature|thermal|conduction|convection|radiation)",
                r"(?i)(thermodynamic|entropy|enthalpy|specific\s+heat)",
                r"(?i)(heat\s+transfer|thermal\s+expansion|insulation)",
                r"(?i)(carnot|stefan.boltzmann|fourier)",
            ])?,
            chemical_patterns: Self::compile_patterns(&[
                r"(?i)(reaction|catalyst|equilibrium|kinetics|stoichiometry)",
                r"(?i)(acid|base|oxidation|reduction|pH|molarity)",
                r"(?i)(chemical\s+bond|molecular|atomic|ionic)",
                r"(?i)(mass\s+transfer|diffusion|absorption|distillation)",
            ])?,
            material_patterns: Self::compile_patterns(&[
                r"(?i)(crystal|grain|microstructure|phase|alloy)",
                r"(?i)(elastic\s+modulus|yield\s+strength|hardness|toughness)",
                r"(?i)(composite|polymer|ceramic|metal|semiconductor)",
                r"(?i)(corrosion|oxidation|creep|fracture|fatigue)",
            ])?,
            system_patterns: Self::compile_patterns(&[
                r"(?i)(feedback|control|regulation|stability|response)",
                r"(?i)(input|output|transfer\s+function|block\s+diagram)",
                r"(?i)(system\s+dynamics|optimization|performance|reliability)",
                r"(?i)(redundancy|fault\s+tolerance|safety\s+factor)",
            ])?,
            process_patterns: Self::compile_patterns(&[
                r"(?i)(manufacturing|production|assembly|quality\s+control)",
                r"(?i)(workflow|procedure|protocol|standard|specification)",
                r"(?i)(efficiency|throughput|yield|waste|optimization)",
                r"(?i)(automation|robotics|lean|six\s+sigma)",
            ])?,
            design_patterns: Self::compile_patterns(&[
                r"(?i)(requirement|specification|constraint|objective)",
                r"(?i)(iteration|prototype|validation|verification)",
                r"(?i)(trade.off|optimization|design\s+space|parameter)",
                r"(?i)(modularity|scalability|maintainability|sustainability)",
            ])?,
            principle_extractors: Self::compile_patterns(&[
                r"(?i)(principle|law|theorem|rule|equation|formula)",
                r"(?i)(based\s+on|according\s+to|governed\s+by|follows)",
                r"(?i)(fundamental|basic|key|essential|critical|important)",
                r"(?i)(mechanism|process|phenomenon|effect|relationship)",
            ])?,
            related_term_extractors: Self::compile_patterns(&[
                r"(?i)(related\s+to|associated\s+with|connected\s+to|linked\s+to)",
                r"(?i)(component|part|element|subsystem|module)",
                r"(?i)(application|use|implementation|example)",
                r"(?i)(see\s+also|similar|comparable|analogous)",
            ])?,
        })
    }

    fn compile_patterns(patterns: &[&str]) -> Result<Vec<Regex>> {
        patterns
            .iter()
            .map(|pattern| {
                Regex::new(pattern).map_err(|e| WikiEngineError::Analysis(format!("Regex error: {}", e)))
            })
            .collect()
    }

    pub fn analyze_page(&self, page: &WikipediaPage) -> Result<Vec<EngineeringPrinciple>> {
        let mut principles = Vec::new();
        let text = &page.extract;
        
        // Split text into sentences for better analysis
        let sentences: Vec<&str> = text.split(". ").collect();
        
        for (i, sentence) in sentences.iter().enumerate() {
            if let Some(principle) = self.extract_principle_from_sentence(sentence, page, i)? {
                principles.push(principle);
            }
        }

        // Deduplicate and rank principles
        self.deduplicate_and_rank(principles)
    }

    fn extract_principle_from_sentence(
        &self,
        sentence: &str,
        page: &WikipediaPage,
        _index: usize,
    ) -> Result<Option<EngineeringPrinciple>> {
        // Check if sentence contains principle indicators
        let has_principle_indicators = self.principle_extractors.iter()
            .any(|pattern| pattern.is_match(sentence));

        if !has_principle_indicators {
            return Ok(None);
        }

        // Determine category based on pattern matching
        let category = self.categorize_text(sentence);
        
        // Extract related terms
        let related_terms = self.extract_related_terms(sentence);

        // Calculate confidence based on multiple factors
        let confidence = self.calculate_confidence(sentence, &category);

        if confidence < 0.3 {
            return Ok(None);
        }

        // Generate a meaningful title
        let title = self.extract_principle_title(sentence);

        Ok(Some(EngineeringPrinciple {
            id: uuid::Uuid::new_v4().to_string(),
            title,
            description: sentence.trim().to_string(),
            category,
            confidence,
            source_url: page.url.clone(),
            related_terms,
        }))
    }

    fn categorize_text(&self, text: &str) -> PrincipleCategory {
        let categories = vec![
            (&self.structural_patterns, PrincipleCategory::Structural),
            (&self.mechanical_patterns, PrincipleCategory::Mechanical),
            (&self.electrical_patterns, PrincipleCategory::Electrical),
            (&self.thermal_patterns, PrincipleCategory::Thermal),
            (&self.chemical_patterns, PrincipleCategory::Chemical),
            (&self.material_patterns, PrincipleCategory::Material),
            (&self.system_patterns, PrincipleCategory::System),
            (&self.process_patterns, PrincipleCategory::Process),
            (&self.design_patterns, PrincipleCategory::Design),
        ];

        let mut scores = HashMap::new();
        
        for (patterns, category) in categories {
            let mut score = 0;
            for pattern in patterns {
                score += pattern.find_iter(text).count();
            }
            if score > 0 {
                scores.insert(category, score);
            }
        }

        scores.into_iter()
            .max_by_key(|(_, score)| *score)
            .map(|(category, _)| category)
            .unwrap_or(PrincipleCategory::Other("General".to_string()))
    }

    fn extract_related_terms(&self, text: &str) -> Vec<String> {
        let mut terms = HashSet::new();
        
        // Extract technical terms (capitalized words, hyphenated terms)
        let technical_term_pattern = Regex::new(r"\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b|[a-z]+-[a-z]+").unwrap();
        for mat in technical_term_pattern.find_iter(text) {
            let term = mat.as_str().to_string();
            if term.len() > 3 && !self.is_common_word(&term) {
                terms.insert(term);
            }
        }

        // Extract terms following specific patterns
        for pattern in &self.related_term_extractors {
            for mat in pattern.find_iter(text) {
                // Extract words following the pattern
                let start = mat.end();
                if let Some(following_text) = text.get(start..start.min(text.len()).min(start + 50)) {
                    let words: Vec<&str> = following_text.split_whitespace().take(3).collect();
                    if !words.is_empty() {
                        let term = words.join(" ");
                        if !self.is_common_word(&term) {
                            terms.insert(term);
                        }
                    }
                }
            }
        }

        terms.into_iter().take(5).collect()
    }

    fn calculate_confidence(&self, text: &str, category: &PrincipleCategory) -> f32 {
        let mut confidence = 0.0;

        // Base confidence from principle indicators
        let principle_matches = self.principle_extractors.iter()
            .map(|pattern| pattern.find_iter(text).count())
            .sum::<usize>() as f32;
        confidence += principle_matches * 0.2;

        // Category-specific confidence
        let category_patterns = match category {
            PrincipleCategory::Structural => &self.structural_patterns,
            PrincipleCategory::Mechanical => &self.mechanical_patterns,
            PrincipleCategory::Electrical => &self.electrical_patterns,
            PrincipleCategory::Thermal => &self.thermal_patterns,
            PrincipleCategory::Chemical => &self.chemical_patterns,
            PrincipleCategory::Material => &self.material_patterns,
            PrincipleCategory::System => &self.system_patterns,
            PrincipleCategory::Process => &self.process_patterns,
            PrincipleCategory::Design => &self.design_patterns,
            PrincipleCategory::Other(_) => return 0.3,
        };

        let category_matches = category_patterns.iter()
            .map(|pattern| pattern.find_iter(text).count())
            .sum::<usize>() as f32;
        confidence += category_matches * 0.15;

        // Length and structure bonus
        if text.len() > 50 && text.len() < 300 {
            confidence += 0.1;
        }

        // Mathematical expressions bonus
        let math_pattern = Regex::new(r"[=<>±∆∇∑∏∫]|\\[a-zA-Z]+").unwrap();
        if math_pattern.is_match(text) {
            confidence += 0.2;
        }

        confidence.min(1.0)
    }

    fn extract_principle_title(&self, text: &str) -> String {
        // Try to extract a concise title from the sentence
        let words: Vec<&str> = text.split_whitespace().take(8).collect();
        let title = words.join(" ");
        
        // Clean up the title
        title.trim_end_matches(&['.', ',', ';', ':']).to_string()
    }

    fn is_common_word(&self, word: &str) -> bool {
        let common_words = [
            "the", "and", "that", "with", "for", "are", "can", "this", "will", "such",
            "may", "also", "been", "have", "has", "was", "were", "from", "they", "these",
            "more", "some", "other", "than", "only", "very", "when", "where", "what",
        ];
        common_words.contains(&word.to_lowercase().as_str())
    }

    fn deduplicate_and_rank(&self, mut principles: Vec<EngineeringPrinciple>) -> Result<Vec<EngineeringPrinciple>> {
        // Sort by confidence (highest first)
        principles.sort_by(|a, b| b.confidence.partial_cmp(&a.confidence).unwrap());
        
        // Remove very similar principles
        let mut unique_principles = Vec::new();
        for principle in principles {
            let is_duplicate = unique_principles.iter().any(|existing: &EngineeringPrinciple| {
                self.similarity_score(&principle.description, &existing.description) > 0.8
            });
            
            if !is_duplicate {
                unique_principles.push(principle);
            }
        }

        // Limit to top principles
        unique_principles.truncate(10);
        
        Ok(unique_principles)
    }

    fn similarity_score(&self, text1: &str, text2: &str) -> f32 {
        let words1: HashSet<&str> = text1.split_whitespace().collect();
        let words2: HashSet<&str> = text2.split_whitespace().collect();
        
        let intersection = words1.intersection(&words2).count();
        let union = words1.union(&words2).count();
        
        if union == 0 {
            0.0
        } else {
            intersection as f32 / union as f32
        }
    }

    pub fn extract_related_concepts(&self, page: &WikipediaPage) -> Vec<String> {
        let mut concepts = HashSet::new();
        let text = &page.extract;

        // Extract capitalized terms that might be concepts
        let concept_pattern = Regex::new(r"\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b").unwrap();
        for mat in concept_pattern.find_iter(text) {
            let concept = mat.as_str().to_string();
            if concept.len() > 3 && !self.is_common_word(&concept) {
                concepts.insert(concept);
            }
        }

        // Extract terms in parentheses (often definitions or clarifications)
        let paren_pattern = Regex::new(r"\(([^)]+)\)").unwrap();
        for caps in paren_pattern.captures_iter(text) {
            if let Some(content) = caps.get(1) {
                let content_str = content.as_str();
                if content_str.len() > 3 && content_str.len() < 50 {
                    concepts.insert(content_str.to_string());
                }
            }
        }

        concepts.into_iter().take(15).collect()
    }
}