import { 
  AnalysisNode, 
  TreeNodeData, 
  EngineeringPrinciple, 
  PrincipleCategory,
  FilterOptions 
} from '../types';

export class DataTransformUtils {
  // Transform backend AnalysisNode to frontend TreeNodeData
  static transformToTreeData(node: AnalysisNode): TreeNodeData {
    const children = Object.values(node.children || {}).map(child => 
      this.transformToTreeData(child)
    );

    return {
      name: node.term,
      principles: node.principles,
      children: children.length > 0 ? children : undefined,
      depth: node.depth,
      processingTime: node.processing_time_ms,
    };
  }

  // Flatten tree structure for list view
  static flattenTree(node: TreeNodeData): TreeNodeData[] {
    const result: TreeNodeData[] = [node];
    
    if (node.children) {
      for (const child of node.children) {
        result.push(...this.flattenTree(child));
      }
    }
    
    return result;
  }

  // Filter principles based on criteria
  static filterPrinciples(
    principles: EngineeringPrinciple[], 
    filters: FilterOptions
  ): EngineeringPrinciple[] {
    return principles.filter(principle => {
      // Category filter
      const category = this.getPrincipleCategory(principle);
      if (filters.categories.length > 0 && !filters.categories.includes(category)) {
        return false;
      }

      // Confidence filter
      if (principle.confidence < filters.minConfidence) {
        return false;
      }

      // Search text filter
      if (filters.searchText) {
        const searchLower = filters.searchText.toLowerCase();
        const titleMatch = principle.title.toLowerCase().includes(searchLower);
        const descMatch = principle.description.toLowerCase().includes(searchLower);
        const termMatch = principle.related_terms.some(term => 
          term.toLowerCase().includes(searchLower)
        );
        
        if (!titleMatch && !descMatch && !termMatch) {
          return false;
        }
      }

      return true;
    });
  }

  // Extract category from principle
  static getPrincipleCategory(principle: EngineeringPrinciple): PrincipleCategory {
    if (typeof principle.category === 'string') {
      return principle.category as PrincipleCategory;
    } else if (typeof principle.category === 'object' && 'Other' in principle.category) {
      return PrincipleCategory.Other;
    }
    return PrincipleCategory.Other;
  }

  // Get category color for visualization
  static getCategoryColor(category: PrincipleCategory): string {
    const colors = {
      [PrincipleCategory.Structural]: '#FF6B6B',
      [PrincipleCategory.Mechanical]: '#4ECDC4',
      [PrincipleCategory.Electrical]: '#45B7D1',
      [PrincipleCategory.Thermal]: '#FFA07A',
      [PrincipleCategory.Chemical]: '#98D8C8',
      [PrincipleCategory.Material]: '#F7B731',
      [PrincipleCategory.System]: '#5F27CD',
      [PrincipleCategory.Process]: '#FF9FF3',
      [PrincipleCategory.Design]: '#54A0FF',
      [PrincipleCategory.Other]: '#95A5A6',
    };
    return colors[category] || colors[PrincipleCategory.Other];
  }

  // Calculate node statistics
  static calculateNodeStats(node: TreeNodeData): {
    totalPrinciples: number;
    avgConfidence: number;
    categoryDistribution: Record<string, number>;
    maxDepth: number;
  } {
    const allNodes = this.flattenTree(node);
    const allPrinciples = allNodes.flatMap(n => n.principles);
    
    const categoryDistribution: Record<string, number> = {};
    let totalConfidence = 0;
    
    allPrinciples.forEach(principle => {
      const category = this.getPrincipleCategory(principle);
      categoryDistribution[category] = (categoryDistribution[category] || 0) + 1;
      totalConfidence += principle.confidence;
    });

    const maxDepth = Math.max(...allNodes.map(n => n.depth));
    
    return {
      totalPrinciples: allPrinciples.length,
      avgConfidence: allPrinciples.length > 0 ? totalConfidence / allPrinciples.length : 0,
      categoryDistribution,
      maxDepth,
    };
  }

  // Search within analysis results
  static searchInAnalysis(node: TreeNodeData, query: string): TreeNodeData[] {
    const results: TreeNodeData[] = [];
    const queryLower = query.toLowerCase();
    
    const search = (currentNode: TreeNodeData) => {
      // Check node name
      if (currentNode.name.toLowerCase().includes(queryLower)) {
        results.push(currentNode);
      }
      
      // Check principles
      const matchingPrinciples = currentNode.principles.filter(p => 
        p.title.toLowerCase().includes(queryLower) ||
        p.description.toLowerCase().includes(queryLower) ||
        p.related_terms.some(term => term.toLowerCase().includes(queryLower))
      );
      
      if (matchingPrinciples.length > 0) {
        results.push({
          ...currentNode,
          principles: matchingPrinciples,
        });
      }
      
      // Recursively search children
      if (currentNode.children) {
        currentNode.children.forEach(child => search(child));
      }
    };
    
    search(node);
    return results;
  }

  // Generate summary statistics
  static generateSummary(node: TreeNodeData): {
    totalNodes: number;
    totalPrinciples: number;
    averageConfidence: number;
    topCategories: Array<{ category: string; count: number; percentage: number }>;
    processingTimeMs: number;
  } {
    const stats = this.calculateNodeStats(node);
    const allNodes = this.flattenTree(node);
    
    const topCategories = Object.entries(stats.categoryDistribution)
      .map(([category, count]) => ({
        category,
        count,
        percentage: (count / stats.totalPrinciples) * 100,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    
    const totalProcessingTime = allNodes.reduce(
      (sum, node) => sum + node.processingTime,
      0
    );
    
    return {
      totalNodes: allNodes.length,
      totalPrinciples: stats.totalPrinciples,
      averageConfidence: stats.avgConfidence,
      topCategories,
      processingTimeMs: totalProcessingTime,
    };
  }

  // Export data to different formats
  static exportToCSV(node: TreeNodeData): string {
    const allNodes = this.flattenTree(node);
    const rows: string[] = [];
    
    // Header
    rows.push('Term,Depth,Principle_Title,Category,Confidence,Description,Processing_Time_MS');
    
    // Data rows
    allNodes.forEach(nodeData => {
      nodeData.principles.forEach(principle => {
        const category = this.getPrincipleCategory(principle);
        const row = [
          `"${nodeData.name}"`,
          nodeData.depth.toString(),
          `"${principle.title}"`,
          category,
          principle.confidence.toString(),
          `"${principle.description.replace(/"/g, '""')}"`,
          nodeData.processingTime.toString(),
        ];
        rows.push(row.join(','));
      });
    });
    
    return rows.join('\n');
  }

  static exportToJSON(node: TreeNodeData): string {
    return JSON.stringify(node, null, 2);
  }

  // Performance utilities
  static measureRenderTime<T>(fn: () => T, label: string): T {
    const start = performance.now();
    const result = fn();
    const end = performance.now();
    console.log(`${label} took ${end - start} milliseconds`);
    return result;
  }

  // Debounce utility for search
  static debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  }

  // Validate analysis data integrity
  static validateAnalysisData(node: TreeNodeData): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    
    if (!node.name || node.name.trim() === '') {
      errors.push('Node name is required');
    }
    
    if (node.depth < 0) {
      errors.push('Node depth cannot be negative');
    }
    
    if (node.processingTime < 0) {
      errors.push('Processing time cannot be negative');
    }
    
    node.principles.forEach((principle, index) => {
      if (!principle.id) {
        errors.push(`Principle ${index} missing ID`);
      }
      
      if (principle.confidence < 0 || principle.confidence > 1) {
        errors.push(`Principle ${index} confidence out of range (0-1)`);
      }
    });
    
    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}