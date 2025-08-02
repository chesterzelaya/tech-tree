import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Typography,
  Box,
} from '@mui/material';
import {
  BookOpen,
} from 'lucide-react';
import * as THREE from 'three';
import { TreeNodeData } from '../types';
import { DataTransformUtils } from '../utils/dataTransform';

interface TreeVisualizationProps {
  data: TreeNodeData;
  onNodeSelect?: (node: TreeNodeData) => void;
  selectedNode?: TreeNodeData;
  expandedNodes?: Set<string>;
  onToggleExpanded?: (nodeName: string) => void;
}

interface SphereNode {
  node: TreeNodeData;
  mesh: THREE.Mesh;
  label: THREE.Sprite;
  position: THREE.Vector3;
  originalPosition: THREE.Vector3;
}



export const TreeVisualization: React.FC<TreeVisualizationProps> = ({
  data,
  onNodeSelect,
  selectedNode,
  expandedNodes = new Set([data.name]),
  onToggleExpanded,
}) => {
  const [localExpandedNodes, setLocalExpandedNodes] = useState(expandedNodes);
  const [isRotating, setIsRotating] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    sphere: THREE.Mesh;
    nodes: SphereNode[];
    animationId: number;
    rotation: { x: number; y: number };
  } | null>(null);
  const mouseRef = useRef<{
    isDown: boolean;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  }>({ isDown: false, startX: 0, startY: 0, currentX: 0, currentY: 0 });

  const handleToggleExpanded = (nodeName: string) => {
    if (onToggleExpanded) {
      onToggleExpanded(nodeName);
    } else {
      const newExpanded = new Set(localExpandedNodes);
      if (newExpanded.has(nodeName)) {
        newExpanded.delete(nodeName);
      } else {
        newExpanded.add(nodeName);
      }
      setLocalExpandedNodes(newExpanded);
    }
  };

  const handleNodeSelect = (node: TreeNodeData) => {
    onNodeSelect?.(node);
  };



  const treeStats = useMemo(() => {
    return DataTransformUtils.calculateNodeStats(data);
  }, [data]);

  // Create hierarchical node structure
  const hierarchicalNodes = useMemo(() => {
    const nodesByDepth: { [depth: number]: TreeNodeData[] } = {};
    
    const traverse = (node: TreeNodeData, depth: number = 0) => {
      if (!nodesByDepth[depth]) nodesByDepth[depth] = [];
      nodesByDepth[depth].push(node);
      
      if (node.children) {
        node.children.forEach(child => traverse(child, depth + 1));
      }
    };
    
    traverse(data);
    return nodesByDepth;
  }, [data]);

  // Initialize 3D Scene
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Create vertical connection lines for each depth level
    const connectionLines: THREE.Object3D[] = [];

    // Create nodes in hierarchical tree structure
    const nodes: SphereNode[] = [];
    const nodeRadius = 0.12;
    const depthSpacing = 4; // Vertical distance between levels
    const baseRingRadius = 2; // Base radius for circular arrangements

    Object.entries(hierarchicalNodes).forEach(([depthStr, depthNodes]) => {
      const depth = parseInt(depthStr);
      const yPosition = -depth * depthSpacing; // Top to bottom
      
      if (depth === 0) {
        // Root node at the top center
        const rootNode = depthNodes[0];
        const position = new THREE.Vector3(0, yPosition, 0);
        
        // Create enhanced root node with glow effect
        const rootGeometry = new THREE.SphereGeometry(nodeRadius * 1.8, 64, 64);
        const avgConfidence = rootNode.principles.length > 0 
          ? rootNode.principles.reduce((sum, p) => sum + p.confidence, 0) / rootNode.principles.length 
          : 0;
        
        const color = avgConfidence >= 0.8 ? 0x4caf50 : avgConfidence >= 0.6 ? 0xff9800 : 0xf44336;
        const rootMaterial = new THREE.MeshPhongMaterial({
          color,
          transparent: true,
          opacity: 0.95,
          emissive: color,
          emissiveIntensity: 0.3,
          shininess: 100,
        });
        
        const rootMesh = new THREE.Mesh(rootGeometry, rootMaterial);
        
        rootMesh.position.copy(position);
        rootMesh.castShadow = true;
        rootMesh.receiveShadow = true;
        (rootMesh as any).userData = { nodeData: rootNode, index: 0 };

        // Enhanced root label with high DPI support
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d')!;
        const dpr = window.devicePixelRatio || 1;
        const width = 512 * dpr;
        const height = 128 * dpr;
        
        canvas.width = width;
        canvas.height = height;
        context.scale(dpr, dpr);
        
        // Enable text smoothing
        context.imageSmoothingEnabled = true;
        (context as any).textRenderingOptimization = 'optimizeQuality';
        
        context.shadowColor = 'rgba(25, 118, 210, 0.8)';
        context.shadowBlur = 4;
        context.font = 'bold 32px "Space Mono", monospace';
        context.fillStyle = 'white';
        context.textAlign = 'center';
        context.strokeStyle = 'rgba(25, 118, 210, 0.4)';
        context.lineWidth = 1;
        context.strokeText(rootNode.name, 256, 64);
        context.fillText(rootNode.name, 256, 64);

        const rootTexture = new THREE.CanvasTexture(canvas);
        rootTexture.minFilter = THREE.LinearFilter;
        rootTexture.magFilter = THREE.LinearFilter;
        rootTexture.generateMipmaps = false;
        
        const rootSpriteMaterial = new THREE.SpriteMaterial({ 
          map: rootTexture, 
          transparent: true,
          alphaTest: 0.1,
        });
        const rootLabel = new THREE.Sprite(rootSpriteMaterial);
        rootLabel.position.set(0, yPosition + 1, 0);
        rootLabel.scale.set(2, 0.5, 1);

        scene.add(rootMesh);
        scene.add(rootLabel);

        nodes.push({
          node: rootNode,
          mesh: rootMesh,
          label: rootLabel,
          position: position.clone(),
          originalPosition: position.clone(),
        });
        
      } else {
        // Arrange child nodes in circular rings
        const ringRadius = baseRingRadius + (depth - 1) * 0.5;
        const angleStep = (2 * Math.PI) / depthNodes.length;
        
        depthNodes.forEach((nodeData, nodeIndex) => {
          const angle = nodeIndex * angleStep;
          const x = Math.cos(angle) * ringRadius;
          const z = Math.sin(angle) * ringRadius;
          const position = new THREE.Vector3(x, yPosition, z);

          // Create enhanced node with glow effect
          const nodeGeometry = new THREE.SphereGeometry(nodeRadius, 32, 32);
          const avgConfidence = nodeData.principles.length > 0 
            ? nodeData.principles.reduce((sum, p) => sum + p.confidence, 0) / nodeData.principles.length 
            : 0;
          
          const color = avgConfidence >= 0.8 ? 0x4caf50 : avgConfidence >= 0.6 ? 0xff9800 : 0xf44336;
          const nodeMaterial = new THREE.MeshPhongMaterial({
            color,
            transparent: true,
            opacity: 0.95,
            emissive: color,
            emissiveIntensity: 0.25,
            shininess: 80,
          });
          
          const mesh = new THREE.Mesh(nodeGeometry, nodeMaterial);
          
          mesh.position.copy(position);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          (mesh as any).userData = { nodeData, index: nodeIndex };

          // Create enhanced text label with high DPI support
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d')!;
          const dpr = window.devicePixelRatio || 1;
          const width = 512 * dpr;
          const height = 128 * dpr;
          
          canvas.width = width;
          canvas.height = height;
          context.scale(dpr, dpr);
          
          // Enable text smoothing
          context.imageSmoothingEnabled = true;
          (context as any).textRenderingOptimization = 'optimizeQuality';
          
          context.shadowColor = 'rgba(25, 118, 210, 0.6)';
          context.shadowBlur = 2;
          context.font = 'bold 24px "Space Mono", monospace';
          context.fillStyle = 'white';
          context.textAlign = 'center';
          context.strokeStyle = 'rgba(25, 118, 210, 0.3)';
          context.lineWidth = 0.5;
          context.strokeText(nodeData.name, 256, 64);
          context.fillText(nodeData.name, 256, 64);

          const texture = new THREE.CanvasTexture(canvas);
          texture.minFilter = THREE.LinearFilter;
          texture.magFilter = THREE.LinearFilter;
          texture.generateMipmaps = false;
          
          const spriteMaterial = new THREE.SpriteMaterial({ 
            map: texture, 
            transparent: true,
            alphaTest: 0.1,
          });
          const label = new THREE.Sprite(spriteMaterial);
          label.position.set(x, yPosition + 0.5, z);
          label.scale.set(1.5, 0.4, 1);

          scene.add(mesh);
          scene.add(label);

          nodes.push({
            node: nodeData,
            mesh,
            label,
            position: position.clone(),
            originalPosition: position.clone(),
          });

          // Create smooth curved connection to parent (if not root)
          if (depth > 0) {
            const parentY = -(depth - 1) * depthSpacing;
            const parentPos = new THREE.Vector3(0, parentY, 0);
            const childPos = new THREE.Vector3(x, yPosition, z);
            
            // Create control point for smooth curve
            const midY = (parentY + yPosition) / 2;
            const controlDistance = ringRadius * 0.3;
            const controlPoint = new THREE.Vector3(
              x * 0.5 + (Math.random() - 0.5) * controlDistance,
              midY - controlDistance,
              z * 0.5 + (Math.random() - 0.5) * controlDistance
            );
            
            // Create curved line using QuadraticBezierCurve3
            const curve = new THREE.QuadraticBezierCurve3(parentPos, controlPoint, childPos);
            const curvePoints = curve.getPoints(20);
            const curveGeometry = new THREE.BufferGeometry().setFromPoints(curvePoints);
            
            const curveMaterial = new THREE.LineBasicMaterial({
              color: 0x1976d2,
              transparent: true,
              opacity: 0.6,
              linewidth: 2,
            });
            
            const curveLine = new THREE.Line(curveGeometry, curveMaterial);
            scene.add(curveLine);
            connectionLines.push(curveLine);
            
            // Add glowing tube along the curve for extra beauty
            const tubeGeometry = new THREE.TubeGeometry(curve, 20, 0.02, 8, false);
            const tubeMaterial = new THREE.MeshPhongMaterial({
              color: 0x42a5f5,
              transparent: true,
              opacity: 0.3,
              emissive: 0x1976d2,
              emissiveIntensity: 0.2,
            });
            const tube = new THREE.Mesh(tubeGeometry, tubeMaterial);
            scene.add(tube);
            connectionLines.push(tube);
          }
        });
      }
    });

    // Enhanced lighting setup
    const ambientLight = new THREE.AmbientLight(0x404040, 0.3);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    // Add point lights for more dynamic lighting
    const pointLight1 = new THREE.PointLight(0x2196f3, 0.5, 50);
    pointLight1.position.set(10, 0, 10);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0xff4081, 0.3, 50);
    pointLight2.position.set(-10, 0, -10);
    scene.add(pointLight2);

    // Position camera for tree view (zoomed in closer)
    camera.position.set(0, 2, 5);
    camera.lookAt(0, 0, 0);

    // Raycaster for click detection
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    // Mouse event handlers
    const handleMouseDown = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(nodes.map(n => n.mesh));

      if (intersects.length > 0) {
        const clickedNode = intersects[0].object.userData.nodeData;
        onNodeSelect?.(clickedNode);
        return;
      }

      mouseRef.current.isDown = true;
      mouseRef.current.startX = event.clientX;
      mouseRef.current.startY = event.clientY;
      setIsRotating(true);
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (!mouseRef.current.isDown) return;

      const deltaX = event.clientX - mouseRef.current.startX;
      const deltaY = event.clientY - mouseRef.current.startY;

      if (sceneRef.current) {
        // Horizontal rotation around Y-axis
        sceneRef.current.rotation.y += deltaX * 0.01;
        // Vertical camera movement
        sceneRef.current.camera.position.y += deltaY * 0.02;
      }

      mouseRef.current.startX = event.clientX;
      mouseRef.current.startY = event.clientY;
    };

    const handleMouseUp = () => {
      mouseRef.current.isDown = false;
      setIsRotating(false);
    };

    canvas.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    // Add scroll wheel support for vertical navigation
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (sceneRef.current) {
        sceneRef.current.camera.position.y -= event.deltaY * 0.01;
        // Constrain camera movement
        sceneRef.current.camera.position.y = Math.max(
          Math.min(sceneRef.current.camera.position.y, 5),
          -Object.keys(hierarchicalNodes).length * depthSpacing - 2
        );
      }
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      
      if (sceneRef.current) {
        // Apply rotation around Y-axis only (horizontal rotation)
        nodes.forEach((nodeItem) => {
          const rotatedPosition = nodeItem.originalPosition.clone();
          rotatedPosition.applyEuler(new THREE.Euler(0, sceneRef.current!.rotation.y, 0));
          nodeItem.mesh.position.copy(rotatedPosition);
          
          // Update labels to stay above nodes
          const labelPosition = rotatedPosition.clone();
          labelPosition.y += 0.5;
          nodeItem.label.position.copy(labelPosition);
        });

        // Rotate connection lines
        connectionLines.forEach((obj) => {
          obj.rotation.y = sceneRef.current!.rotation.y;
        });
      }

      renderer.render(scene, camera);
    };

    sceneRef.current = { scene, camera, renderer, sphere: nodes[0]?.mesh || new THREE.Mesh(), nodes, animationId: 0, rotation: { x: 0, y: 0 } };
    (sceneRef.current as any).connectionLines = connectionLines;
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
      canvas.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('wheel', handleWheel);
      
      if (sceneRef.current) {
        cancelAnimationFrame(sceneRef.current.animationId);
        sceneRef.current.renderer.dispose();
      }
    };
  }, [hierarchicalNodes, onNodeSelect]);

  // Update selected node visualization
  useEffect(() => {
    if (!sceneRef.current || !selectedNode) return;

    sceneRef.current.nodes.forEach((nodeItem) => {
      const isSelected = nodeItem.node.name === selectedNode.name;
      const material = nodeItem.mesh.material as THREE.MeshPhongMaterial;
      
      if (isSelected) {
        material.emissive.setHex(0x444444);
        nodeItem.mesh.scale.setScalar(1.5);
        nodeItem.label.scale.set(1.5, 0.375, 1.5);
      } else {
        material.emissive.setHex(0x000000);
        nodeItem.mesh.scale.setScalar(1);
        nodeItem.label.scale.set(1, 0.25, 1);
      }
    });
  }, [selectedNode]);

  return (
    <Box sx={{ position: 'relative', width: '100%', height: '100vh', overflow: 'hidden' }}>
      {/* Left Info Panel */}
      <Box 
        sx={{ 
          position: 'absolute',
          top: 20,
          left: 20,
          zIndex: 20,
          width: '300px',
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(20px)',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          p: 3,
          transition: 'all 0.3s ease-in-out',
        }}
      >
        <Typography 
          variant="h5" 
          sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 1,
            color: 'white',
            fontWeight: 300,
            mb: 2,
            textShadow: '0 0 20px rgba(25, 118, 210, 0.5)',
          }}
        >
          <BookOpen size={24} />
          Knowledge Tree
        </Typography>
        
        {/* Analysis Subject */}
        <Box sx={{ mb: 3, p: 2, background: 'rgba(25, 118, 210, 0.1)', borderRadius: '12px', border: '1px solid rgba(25, 118, 210, 0.2)' }}>
          <Typography variant="subtitle2" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 0.5 }}>
            Analyzing:
          </Typography>
          <Typography variant="h6" sx={{ color: 'white', fontWeight: 600 }}>
            {data.name}
          </Typography>
        </Box>
        
        {/* Stats Grid */}
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 3 }}>
          <Box sx={{ textAlign: 'center', p: 2, background: 'rgba(76, 175, 80, 0.1)', borderRadius: '12px' }}>
            <Typography variant="h4" sx={{ color: '#4caf50', fontWeight: 700 }}>
              {treeStats.totalPrinciples}
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
              Principles
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'center', p: 2, background: 'rgba(220, 0, 78, 0.1)', borderRadius: '12px' }}>
            <Typography variant="h4" sx={{ color: '#dc004e', fontWeight: 700 }}>
              {Object.values(hierarchicalNodes).flat().length}
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
              Nodes
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'center', p: 2, background: 'rgba(255, 152, 0, 0.1)', borderRadius: '12px' }}>
            <Typography variant="h4" sx={{ color: '#ff9800', fontWeight: 700 }}>
              {(treeStats.avgConfidence * 100).toFixed(0)}%
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
              Confidence
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'center', p: 2, background: 'rgba(33, 150, 243, 0.1)', borderRadius: '12px' }}>
            <Typography variant="h4" sx={{ color: '#2196f3', fontWeight: 700 }}>
              {Object.keys(hierarchicalNodes).length}
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
              Levels
            </Typography>
          </Box>
        </Box>

        {/* Confidence Legend */}
        <Box sx={{ p: 2, background: 'rgba(255, 255, 255, 0.05)', borderRadius: '12px' }}>
          <Typography variant="subtitle2" sx={{ color: 'white', mb: 1.5, fontWeight: 600 }}>
            Confidence Colors
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#4caf50', boxShadow: '0 0 10px rgba(76, 175, 80, 0.5)' }} />
              <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                High (≥80%)
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#ff9800', boxShadow: '0 0 10px rgba(255, 152, 0, 0.5)' }} />
              <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                Medium (60-79%)
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#f44336', boxShadow: '0 0 10px rgba(244, 67, 54, 0.5)' }} />
              <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                Low (&lt;60%)
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Navigation Info */}
        <Box sx={{ mt: 2, p: 2, background: 'rgba(33, 150, 243, 0.1)', borderRadius: '12px' }}>
          <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.8)', display: 'block', mb: 0.5 }}>
            🖱️ Drag to rotate around tree
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.8)', display: 'block', mb: 0.5 }}>
            🎯 Click nodes to explore details
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.8)', display: 'block' }}>
            🖱️ Scroll to navigate vertically
          </Typography>
        </Box>
      </Box>

      {/* Fullscreen 3D Canvas */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          cursor: isRotating ? 'grabbing' : 'grab',
          background: 'radial-gradient(ellipse at center, rgba(25, 118, 210, 0.05) 0%, rgba(0, 0, 0, 0.95) 100%)',
        }}
      />
      

    </Box>
  );
};