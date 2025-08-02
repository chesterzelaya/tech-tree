import React, { useState, useCallback, useEffect } from 'react';
import {
  CssBaseline,
  ThemeProvider,
  createTheme,
  Snackbar,
  Alert,
  Box,
  Typography,
  Backdrop,
  CircularProgress,
} from '@mui/material';

import { SearchInterface } from './components/SearchInterface';
import { TreeVisualization } from './components/TreeVisualization';
import { PrincipleDetails } from './components/PrincipleDetails';
import { SearchRequest, AnalysisResult, TreeNodeData } from './types';
import { DataTransformUtils } from './utils/dataTransform';
import { WikiEngineAPI } from './services/api';

function App() {
  // Theme state
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });

  // Analysis state
  const [currentRequest, setCurrentRequest] = useState<SearchRequest | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [treeData, setTreeData] = useState<TreeNodeData | null>(null);
  const [selectedNode, setSelectedNode] = useState<TreeNodeData | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);

  // UI state
  const [error, setError] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  // Theme
  const theme = createTheme({
    palette: {
      mode: darkMode ? 'dark' : 'light',
      primary: {
        main: '#1976d2',
      },
      secondary: {
        main: '#dc004e',
      },
    },
    typography: {
      fontFamily: '"Space Mono", "Consolas", "Monaco", "Courier New", monospace',
      h4: {
        fontWeight: 600,
      },
      h6: {
        fontWeight: 600,
      },
    },
    shape: {
      borderRadius: 8,
    },
    components: {
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
        },
      },
    },
  });

  // Add keyframes for animations
  const animationKeyframes = `
    @keyframes float {
      0%, 100% { transform: translateY(0px); }
      50% { transform: translateY(-10px); }
    }



    @keyframes gradientShift {
      0% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }

    @keyframes connect {
      0% { stroke-dashoffset: 1000; opacity: 0; }
      50% { opacity: 0.6; }
      100% { stroke-dashoffset: 0; opacity: 0.2; }
    }

    @keyframes sparkle {
      0%, 100% { opacity: 0; transform: scale(0); }
      50% { opacity: 1; transform: scale(1); }
    }

    .playwrite-hu-title {
      font-family: "Playwrite HU", cursive !important;
      font-optical-sizing: auto;
      font-weight: 300;
      font-style: normal;
      font-display: swap;
    }
  `;



  // Save dark mode preference
  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
  }, [darkMode]);

  const handleAnalysisStart = useCallback((request: SearchRequest) => {
    setCurrentRequest(request);
    setIsLoading(true);
    setError(null);
    setAnalysisResult(null);
    setTreeData(null);
    setSelectedNode(undefined);
    setExpandedNodes(new Set([request.term]));
  }, []);

  const handleAnalysisComplete = useCallback((result: AnalysisResult) => {
    setAnalysisResult(result);
    const transformedData = DataTransformUtils.transformToTreeData(result.tree);
    setTreeData(transformedData);
    setSelectedNode(transformedData);
    setIsLoading(false);
    
    // Auto-expand root and first level
    const newExpanded = new Set([result.root_term]);
    if (transformedData.children) {
      transformedData.children.forEach(child => {
        newExpanded.add(child.name);
      });
    }
    setExpandedNodes(newExpanded);
  }, []);

  const handleError = useCallback((errorMessage: string) => {
    setError(errorMessage);
    setIsLoading(false);
  }, []);

  const handleNodeSelect = useCallback((node: TreeNodeData) => {
    setSelectedNode(node);
  }, []);

  const handleToggleExpanded = useCallback((nodeName: string) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeName)) {
        newSet.delete(nodeName);
      } else {
        newSet.add(nodeName);
      }
      return newSet;
    });
  }, []);



  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <style>{animationKeyframes}</style>
      




      {/* Animated Background */}
      <Box 
        sx={{ 
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: -1,
          background: `
            radial-gradient(circle at 20% 80%, rgba(25, 118, 210, 0.15) 0%, transparent 50%),
            radial-gradient(circle at 80% 20%, rgba(25, 118, 210, 0.1) 0%, transparent 50%),
            radial-gradient(circle at 40% 40%, rgba(25, 118, 210, 0.05) 0%, transparent 50%),
            linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%)
          `,
          backgroundSize: '400% 400%',
          animation: 'gradientShift 20s ease infinite',
        }}
      >


        {/* Network Connection Lines */}
        <svg
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            opacity: 0.3,
          }}
        >
          {[...Array(8)].map((_, i) => (
            <line
              key={i}
              x1={`${Math.random() * 100}%`}
              y1={`${Math.random() * 100}%`}
              x2={`${Math.random() * 100}%`}
              y2={`${Math.random() * 100}%`}
              stroke="rgba(25, 118, 210, 0.2)"
              strokeWidth="1"
              strokeDasharray="5,5"
              style={{
                animation: `connect ${Math.random() * 10 + 8}s ease-in-out infinite`,
                animationDelay: `${Math.random() * 5}s`,
              }}
            />
          ))}
        </svg>

        {/* Sparkle Points */}
        {[...Array(20)].map((_, i) => (
          <Box
            key={i}
            sx={{
              position: 'absolute',
              width: '4px',
              height: '4px',
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              background: 'rgba(25, 118, 210, 0.8)',
              borderRadius: '50%',
              boxShadow: '0 0 10px rgba(25, 118, 210, 0.6)',
              animation: `sparkle ${Math.random() * 8 + 4}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 8}s`,
            }}
          />
        ))}
      </Box>

      {/* Main Content - Immersive 3D Interface */}
      <Box sx={{ position: 'relative', height: '100vh', overflow: 'hidden' }}>
        
        {/* Landing Title - Only shown when no data */}
        {!treeData && (
          <Box
            sx={{
              position: 'absolute',
              top: '25%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              zIndex: 5,
              transition: 'all 0.5s ease-in-out',
              width: '100%',
              maxWidth: '800px',
            }}
          >
            <Typography
              variant="h1"
              className="playwrite-hu-title"
              sx={{
                fontSize: { xs: '3.5rem', sm: '4.5rem', md: '5.5rem' },
                color: 'white',
                textShadow: '0 0 30px rgba(25, 118, 210, 0.6)',
                marginBottom: { xs: 3, sm: 4 },
                letterSpacing: '0.02em',
                lineHeight: 1.1,
              }}
            >
              Tech Tree
            </Typography>
            <Typography
              variant="h5"
              sx={{
                fontFamily: '"Space Mono", monospace',
                fontSize: { xs: '1rem', sm: '1.2rem', md: '1.4rem' },
                fontWeight: 400,
                color: 'rgba(255, 255, 255, 0.8)',
                textShadow: '0 0 15px rgba(25, 118, 210, 0.3)',
                letterSpacing: '0.05em',
                maxWidth: '700px',
                margin: '0 auto',
                marginBottom: { xs: 6, sm: 8 },
                lineHeight: 1.4,
                px: 2,
              }}
            >
              Recursively explore through humanity's greatest inventions
            </Typography>
          </Box>
        )}

        {/* Minimalist Floating Search Interface */}
        <Box 
          sx={{ 
            position: 'absolute',
            top: treeData ? 20 : '55%',
            left: '50%',
            zIndex: 10,
            width: treeData ? '400px' : '600px',
            transition: 'all 0.5s ease-in-out',
            transform: treeData ? 'translateX(-50%)' : 'translate(-50%, -50%)',
            opacity: treeData ? 0.8 : 1,
          }}
        >
          <SearchInterface
            onAnalysisStart={handleAnalysisStart}
            onAnalysisComplete={handleAnalysisComplete}
            onError={handleError}
            isLoading={isLoading}
          />
        </Box>

        {/* Main 3D Visualization */}
        {treeData && (
          <Box sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
            <TreeVisualization
              data={treeData}
              onNodeSelect={handleNodeSelect}
              selectedNode={selectedNode}
              expandedNodes={expandedNodes}
              onToggleExpanded={handleToggleExpanded}
            />
          </Box>
        )}

        {/* Right Panel - Node Details */}
        {selectedNode && (
          <Box
            sx={{
              position: 'absolute',
              top: 20,
              right: 20,
              width: '380px',
              maxHeight: 'calc(100vh - 40px)',
              zIndex: 15,
              background: 'rgba(0, 0, 0, 0.9)',
              backdropFilter: 'blur(25px)',
              borderRadius: '16px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              transform: 'translateX(0)',
              transition: 'all 0.3s ease-in-out',
              overflowY: 'auto',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
            }}
          >
            <PrincipleDetails node={selectedNode} />
          </Box>
        )}


      </Box>

      {/* Loading Backdrop */}
      <Backdrop
        sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}
        open={isLoading}
      >
        <Box sx={{ textAlign: 'center' }}>
          <CircularProgress color="inherit" size={60} />
          <Typography variant="h6" sx={{ mt: 2 }}>
            Analyzing {currentRequest?.term}...
          </Typography>
          <Typography variant="body2" sx={{ mt: 1, opacity: 0.8 }}>
            This may take a few moments for deep analysis
          </Typography>
        </Box>
      </Backdrop>

      {/* Error Snackbar */}
      <Snackbar
        open={!!error}
        autoHideDuration={8000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setError(null)} severity="error" sx={{ width: '100%' }}>
          {error}
        </Alert>
      </Snackbar>
    </ThemeProvider>
  );
}

export default App;
