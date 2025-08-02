import axios, { AxiosResponse } from 'axios';
import { 
  SearchRequest, 
  AnalysisResult, 
  ApiResponse, 
  SearchSuggestion, 
  CacheStats 
} from '../types';

import { API_CONFIG } from '../config';

const API_BASE_URL = API_CONFIG.BASE_URL;

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000, // 2 minutes timeout for complex analyses
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for logging
apiClient.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => {
    console.log(`API Response: ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export class WikiEngineAPI {
  static async analyzeTermRecursive(request: SearchRequest): Promise<AnalysisResult> {
    try {
      const response: AxiosResponse<ApiResponse<AnalysisResult>> = await apiClient.post(
        '/analyze',
        request
      );
      
      if (response.data.success && response.data.data) {
        return response.data.data;
      } else {
        throw new Error(response.data.error || 'Analysis failed');
      }
    } catch (error: any) {
      if (error.response?.status === 504) {
        throw new Error('Analysis timeout - try reducing max_depth or max_results');
      }
      throw new Error(error.response?.data?.error || error.message || 'Network error');
    }
  }

  static async analyzeTermQuick(
    term: string, 
    maxDepth: number = 2, 
    maxResults: number = 5
  ): Promise<AnalysisResult> {
    const response: AxiosResponse<ApiResponse<AnalysisResult>> = await apiClient.get(
      `/analyze?term=${encodeURIComponent(term)}&max_depth=${maxDepth}&max_results=${maxResults}`
    );
    
    if (response.data.success && response.data.data) {
      return response.data.data;
    } else {
      throw new Error(response.data.error || 'Analysis failed');
    }
  }

  static async searchSuggestions(query: string, limit: number = 5): Promise<SearchSuggestion[]> {
    try {
      const response: AxiosResponse<ApiResponse<SearchSuggestion[]>> = await apiClient.get(
        `/suggest?query=${encodeURIComponent(query)}&limit=${limit}`
      );
      
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
      return [];
    } catch (error) {
      console.warn('Suggestions failed:', error);
      return [];
    }
  }

  static async getHealthStatus(): Promise<{ status: string; service: string; version: string }> {
    const response: AxiosResponse<ApiResponse<any>> = await apiClient.get('/health');
    
    if (response.data.success && response.data.data) {
      return response.data.data;
    } else {
      throw new Error('Health check failed');
    }
  }

  static async getCacheStats(): Promise<CacheStats> {
    const response: AxiosResponse<ApiResponse<CacheStats>> = await apiClient.get('/cache/stats');
    
    if (response.data.success && response.data.data) {
      return response.data.data;
    } else {
      throw new Error('Failed to get cache stats');
    }
  }

  static async clearCache(): Promise<string> {
    const response: AxiosResponse<ApiResponse<string>> = await apiClient.post('/cache/clear');
    
    if (response.data.success && response.data.data) {
      return response.data.data;
    } else {
      throw new Error('Failed to clear cache');
    }
  }

  // Batch analysis (if the backend supports it)
  static async batchAnalyze(terms: string[], maxDepth: number = 2): Promise<AnalysisResult[]> {
    const requests = terms.map(term => ({ term, max_depth: maxDepth, max_results: 5 }));
    
    // Since we don't have a batch endpoint, we'll make concurrent requests
    const promises = requests.map(request => this.analyzeTermRecursive(request));
    
    try {
      const results = await Promise.allSettled(promises);
      return results
        .filter((result): result is PromiseFulfilledResult<AnalysisResult> => 
          result.status === 'fulfilled'
        )
        .map(result => result.value);
    } catch (error) {
      console.error('Batch analysis failed:', error);
      return [];
    }
  }

  // Stream analysis progress (for future WebSocket implementation)
  static createProgressStream(request: SearchRequest): EventSource | null {
    try {
      const url = `${API_BASE_URL}/analyze/stream?term=${encodeURIComponent(request.term)}&max_depth=${request.max_depth || 3}`;
      return new EventSource(url);
    } catch (error) {
      console.error('Failed to create progress stream:', error);
      return null;
    }
  }
}

// Error handling utilities
export class APIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public endpoint?: string
  ) {
    super(message);
    this.name = 'APIError';
  }
}

export const handleAPIError = (error: any): string => {
  if (error instanceof APIError) {
    return error.message;
  }
  
  if (error.response) {
    // Server responded with error status
    const status = error.response.status;
    const data = error.response.data;
    
    if (status === 504) {
      return 'Request timeout - try reducing analysis complexity';
    } else if (status === 429) {
      return 'Too many requests - please wait before trying again';
    } else if (status >= 500) {
      return 'Server error - please try again later';
    } else if (data?.error) {
      return data.error;
    }
  } else if (error.request) {
    // Network error
    return 'Network error - check your connection';
  }
  
  return error.message || 'An unknown error occurred';
};

// Rate limiting utilities
export class RateLimiter {
  private requests: number[] = [];
  private readonly maxRequests: number;
  private readonly timeWindow: number;

  constructor(maxRequests: number = 10, timeWindowMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.timeWindow = timeWindowMs;
  }

  canMakeRequest(): boolean {
    const now = Date.now();
    this.requests = this.requests.filter(time => now - time < this.timeWindow);
    return this.requests.length < this.maxRequests;
  }

  recordRequest(): void {
    this.requests.push(Date.now());
  }

  getTimeUntilNextRequest(): number {
    if (this.canMakeRequest()) return 0;
    
    const oldestRequest = Math.min(...this.requests);
    return this.timeWindow - (Date.now() - oldestRequest);
  }
}

export const apiRateLimiter = new RateLimiter();