export const API_CONFIG = {
  BASE_URL: process.env.REACT_APP_API_URL || 'http://localhost:3001',
  TIMEOUT: 120000, // 2 minutes
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000,
};

export const APP_CONFIG = {
  NAME: 'Wiki Engineering Analyzer',
  VERSION: '1.0.0',
  DESCRIPTION: 'Recursive analysis of engineering principles from Wikipedia',
  AUTHOR: 'Engineering Analysis Team',
};

export const CACHE_CONFIG = {
  DEFAULT_TTL: 300000, // 5 minutes
  MAX_ENTRIES: 100,
};

export const ANALYSIS_CONFIG = {
  DEFAULT_MAX_DEPTH: 3,
  DEFAULT_MAX_RESULTS: 8,
  MAX_ALLOWED_DEPTH: 5,
  MAX_ALLOWED_RESULTS: 15,
};

// Feature flags
export const FEATURES = {
  DARK_MODE: true,
  EXPORT_DATA: true,
  RECENT_SEARCHES: true,
  SEARCH_SUGGESTIONS: true,
  BATCH_ANALYSIS: false, // Future feature
  REAL_TIME_UPDATES: false, // Future WebSocket feature
};