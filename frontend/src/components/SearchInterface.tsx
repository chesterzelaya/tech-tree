import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  TextField,
  Button,
  Paper,
  Grid,
  Slider,
  Typography,
  Autocomplete,
  Chip,
  Alert,
  CircularProgress,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { Search, Settings, X, BookOpen } from 'lucide-react';
import * as THREE from 'three';
import { SearchRequest, SearchSuggestion, AnalysisResult } from '../types';
import { WikiEngineAPI, handleAPIError, apiRateLimiter } from '../services/api';
import { DataTransformUtils } from '../utils/dataTransform';

interface SearchInterfaceProps {
  onAnalysisStart: (request: SearchRequest) => void;
  onAnalysisComplete: (result: AnalysisResult) => void;
  onError: (error: string) => void;
  isLoading: boolean;
}

const COMMON_ENGINEERING_TERMS = [
  'bridge', 'engine', 'motor', 'gear', 'lever', 'pulley', 'circuit', 'transistor',
  'beam', 'column', 'foundation', 'steel', 'concrete', 'aluminum', 'hydraulic',
  'mechanical advantage', 'stress', 'strain', 'turbine', 'bearing', 'spring',
  'capacitor', 'resistor', 'inductor', 'heat exchanger', 'pump', 'valve',
];

const PRESET_ANALYSES = [
  { term: 'bridge', depth: 3, description: 'Structural engineering fundamentals' },
  { term: 'internal combustion engine', depth: 2, description: 'Mechanical systems' },
  { term: 'transistor', depth: 2, description: 'Electronic components' },
  { term: 'heat exchanger', depth: 2, description: 'Thermal systems' },
];

export const SearchInterface: React.FC<SearchInterfaceProps> = ({
  onAnalysisStart,
  onAnalysisComplete,
  onError,
  isLoading,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [maxDepth, setMaxDepth] = useState(3);
  const [maxResults, setMaxResults] = useState(8);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const [chatActive, setChatActive] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    stars: THREE.Points;
    animationId: number;
  } | null>(null);

  // Debounced search suggestions
  const debouncedGetSuggestions = useCallback(
    DataTransformUtils.debounce(async (query: string) => {
      if (query.length < 2) {
        setSuggestions([]);
        return;
      }

      setLoadingSuggestions(true);
      try {
        const results = await WikiEngineAPI.searchSuggestions(query, 8);
        setSuggestions(results);
      } catch (error) {
        console.warn('Suggestions failed:', error);
        setSuggestions([]);
      } finally {
        setLoadingSuggestions(false);
      }
    }, 500),
    []
  );

  useEffect(() => {
    debouncedGetSuggestions(searchTerm);
  }, [searchTerm, debouncedGetSuggestions]);

  // Rate limiting check
  useEffect(() => {
    const checkRateLimit = () => {
      setRateLimited(!apiRateLimiter.canMakeRequest());
    };

    checkRateLimit();
    const interval = setInterval(checkRateLimit, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      onError('Please enter a search term');
      return;
    }

    if (!apiRateLimiter.canMakeRequest()) {
      const waitTime = Math.ceil(apiRateLimiter.getTimeUntilNextRequest() / 1000);
      onError(`Rate limited. Please wait ${waitTime} seconds before making another request.`);
      return;
    }

    const request: SearchRequest = {
      term: searchTerm.trim(),
      max_depth: maxDepth,
      max_results: maxResults,
    };

    onAnalysisStart(request);
    apiRateLimiter.recordRequest();

    try {
      const result = await WikiEngineAPI.analyzeTermRecursive(request);
      onAnalysisComplete(result);
      
      // Add to recent searches (could be stored in localStorage)
      const recentSearches = JSON.parse(
        localStorage.getItem('recentSearches') || '[]'
      );
      const newSearch = { 
        term: searchTerm, 
        timestamp: Date.now(),
        depth: maxDepth,
        results: result.total_principles 
      };
      const updatedSearches = [newSearch, ...recentSearches.slice(0, 9)];
      localStorage.setItem('recentSearches', JSON.stringify(updatedSearches));
      
    } catch (error) {
      onError(handleAPIError(error));
    }
  };

  const handlePresetAnalysis = async (preset: typeof PRESET_ANALYSES[0]) => {
    setSearchTerm(preset.term);
    setMaxDepth(preset.depth);
    
    const request: SearchRequest = {
      term: preset.term,
      max_depth: preset.depth,
      max_results: maxResults,
    };

    onAnalysisStart(request);

    try {
      const result = await WikiEngineAPI.analyzeTermRecursive(request);
      onAnalysisComplete(result);
    } catch (error) {
      onError(handleAPIError(error));
    }
  };

  const handleClear = () => {
    setSearchTerm('');
    setSuggestions([]);
    setMaxDepth(3);
    setMaxResults(8);
    setChatActive(false);
  };

  // Initialize WebGL galaxy background
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    renderer.setClearColor(0x000000, 0);

    // Create star field
    const starGeometry = new THREE.BufferGeometry();
    const starCount = 2000;
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 2000;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 2000;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 2000;

      // Blue galaxy colors
      const intensity = Math.random() * 0.8 + 0.2;
      colors[i * 3] = intensity * 0.3; // Red
      colors[i * 3 + 1] = intensity * 0.6; // Green
      colors[i * 3 + 2] = intensity; // Blue
    }

    starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const starMaterial = new THREE.PointsMaterial({
      size: 2,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
    });

    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);

    camera.position.z = 1000;

    // Animation loop
    const animate = () => {
      const animationId = requestAnimationFrame(animate);
      
      stars.rotation.x += 0.0005;
      stars.rotation.y += 0.0007;
      
      renderer.render(scene, camera);
      
      if (sceneRef.current) {
        sceneRef.current.animationId = animationId;
      }
    };

    sceneRef.current = { scene, camera, renderer, stars, animationId: 0 };
    animate();

    const handleResize = () => {
      if (!canvas || !sceneRef.current) return;
      const { camera, renderer } = sceneRef.current;
      camera.aspect = canvas.clientWidth / canvas.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (sceneRef.current) {
        cancelAnimationFrame(sceneRef.current.animationId);
        sceneRef.current.renderer.dispose();
      }
    };
  }, []);

  const handleSearchFocus = () => {
    setChatActive(true);
  };

  return (
    <Box sx={{ position: 'relative' }}>
      {/* Minimalist Interface */}
      <Paper 
        elevation={0} 
        sx={{ 
          position: 'relative',
          zIndex: 1,
          p: 2,
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '16px',
          transition: 'all 0.3s ease-in-out',
        }}
      >
        <Grid container spacing={2}>
          {/* Minimalist Search */}
          <Grid size={12}>
            <Typography 
              variant="h6" 
              gutterBottom 
              sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 1,
                color: 'white',
                fontWeight: 300,
                textAlign: 'center',
                justifyContent: 'center',
              }}
            >
              <BookOpen size={20} />
              Engineering Knowledge Tree
            </Typography>
          </Grid>

        {/* Search Input */}
        <Grid size={12}>
          <Autocomplete
            freeSolo
            options={suggestions.map(s => s.term)}
            inputValue={searchTerm}
            onInputChange={(_, newValue) => setSearchTerm(newValue)}
            loading={loadingSuggestions}
            renderInput={(params) => (
              <TextField
                {...params}
                label={!chatActive ? "Type Interesting Object" : "Engineering Term"}
                placeholder={!chatActive ? "Type Interesting Object..." : "e.g., bridge, engine, transistor..."}
                fullWidth
                variant="outlined"
                onFocus={handleSearchFocus}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '12px',
                    transition: 'all 0.3s ease-in-out',
                    '&:hover': {
                      borderColor: 'rgba(25, 118, 210, 0.5)',
                      boxShadow: '0 0 15px rgba(25, 118, 210, 0.2)',
                    },
                    '&.Mui-focused': {
                      borderColor: '#1976d2',
                      boxShadow: '0 0 20px rgba(25, 118, 210, 0.3)',
                    },
                  },
                  '& .MuiInputLabel-root': {
                    color: 'rgba(25, 118, 210, 0.8)',
                    fontWeight: 500,
                  },
                }}
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {loadingSuggestions && <CircularProgress color="inherit" size={20} />}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
            renderOption={(props, option) => {
              const suggestion = suggestions.find(s => s.term === option);
              return (
                <li {...props}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                    <Typography variant="body2">{option}</Typography>
                    {suggestion && (
                      <Chip 
                        label={suggestion.category} 
                        size="small" 
                        variant="outlined"
                        sx={{ ml: 1 }}
                      />
                    )}
                  </Box>
                </li>
              );
            }}
          />
        </Grid>



        {/* Action Buttons */}
        <Grid size={12}>
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
            <Button
              variant="contained"
              size="large"
              startIcon={<Search size={20} />}
              onClick={handleSearch}
              disabled={isLoading || !searchTerm.trim() || rateLimited}
              sx={{ 
                minWidth: 120,
                background: 'linear-gradient(45deg, #1976d2 30%, #42a5f5 90%)',
                borderRadius: '12px',
                boxShadow: '0 2px 10px rgba(25, 118, 210, 0.3)',
                '&:hover': {
                  boxShadow: '0 4px 15px rgba(25, 118, 210, 0.5)',
                  transform: 'translateY(-1px)',
                },
                transition: 'all 0.3s ease-in-out',
              }}
            >
              {isLoading ? <CircularProgress size={20} color="inherit" /> : 'Analyze'}
            </Button>

            <Button
              variant="outlined"
              startIcon={<X size={16} />}
              onClick={handleClear}
              disabled={isLoading}
              sx={{
                borderColor: 'rgba(255, 255, 255, 0.3)',
                color: 'rgba(255, 255, 255, 0.8)',
                borderRadius: '12px',
                minWidth: 80,
                '&:hover': {
                  borderColor: 'rgba(255, 255, 255, 0.6)',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                },
              }}
            >
              Clear
            </Button>
          </Box>
        </Grid>


      </Grid>
    </Paper>
    </Box>
  );
};