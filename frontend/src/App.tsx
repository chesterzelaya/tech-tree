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
import { 
  Moon, 
  Sun,
} from 'lucide-react';
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

  // Add keyframes for floating animation
  const floatKeyframes = `
    @keyframes float {
      0%, 100% { transform: translateY(0px); }
      50% { transform: translateY(-10px); }
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
      <style>{floatKeyframes}</style>
      




      {/* Main Content - Immersive 3D Interface */}
      <Box sx={{ position: 'relative', height: '100vh', overflow: 'hidden' }}>
        
        {/* Minimalist Floating Search Interface */}
        <Box 
          sx={{ 
            position: 'absolute',
            top: treeData ? 20 : '50%',
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
        {treeData ? (
          <Box sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
            <TreeVisualization
              data={treeData}
              onNodeSelect={handleNodeSelect}
              selectedNode={selectedNode}
              expandedNodes={expandedNodes}
              onToggleExpanded={handleToggleExpanded}
            />
          </Box>
        ) : (
          // Beautiful landing background when no data
          <Box 
            sx={{ 
              position: 'absolute', 
              top: 0, 
              left: 0, 
              width: '100%', 
              height: '100%',
              background: 'radial-gradient(ellipse at center, rgba(25, 118, 210, 0.1) 0%, rgba(0, 0, 0, 0.9) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                background: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.02'%3E%3Ccircle cx='30' cy='30' r='1'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                animation: 'float 6s ease-in-out infinite',
              },
            }}
          >

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
