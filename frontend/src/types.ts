export interface SearchRequest {
  term: string;
  max_depth?: number;
  max_results?: number;
}

export enum PrincipleCategory {
  Structural = 'Structural',
  Mechanical = 'Mechanical',
  Electrical = 'Electrical',
  Thermal = 'Thermal',
  Chemical = 'Chemical',
  Material = 'Material',
  System = 'System',
  Process = 'Process',
  Design = 'Design',
  Other = 'Other'
}

export interface EngineeringPrinciple {
  id: string;
  title: string;
  description: string;
  category: PrincipleCategory | { Other: string };
  confidence: number;
  source_url: string;
  related_terms: string[];
}

export interface AnalysisNode {
  term: string;
  principles: EngineeringPrinciple[];
  children: { [key: string]: AnalysisNode };
  depth: number;
  processing_time_ms: number;
}

export interface AnalysisResult {
  root_term: string;
  tree: AnalysisNode;
  total_processing_time_ms: number;
  total_principles: number;
  max_depth_reached: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface SearchSuggestion {
  term: string;
  confidence: number;
  category: string;
}

export interface CacheStats {
  wikipedia_pages_count: number;
  principles_count: number;
  analysis_nodes_count: number;
  total_memory_usage: number;
}

// UI-specific types
export interface TreeNodeData {
  name: string;
  principles: EngineeringPrinciple[];
  children?: TreeNodeData[];
  depth: number;
  processingTime: number;
  x?: number;
  y?: number;
}

export interface AnalysisProgress {
  current_term: string;
  current_depth: number;
  completed_terms: number;
  total_estimated_terms: number;
  percentage_complete: number;
}

export interface FilterOptions {
  categories: PrincipleCategory[];
  minConfidence: number;
  maxDepth: number;
  searchText: string;
}

export interface VisualizationSettings {
  nodeSize: number;
  showPrincipleCount: boolean;
  showProcessingTime: boolean;
  colorByCategory: boolean;
  expandedNodes: Set<string>;
}