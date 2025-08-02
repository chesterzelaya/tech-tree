import React, { useState, useMemo } from 'react';
import {
  Paper,
  Typography,
  Box,
  Chip,
  Card,
  CardContent,
  CardActions,
  Button,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  LinearProgress,
  Tooltip,
  IconButton,
  Divider,
  Link,
  List,
  ListItem,
  ListItemText,
  useTheme,
  alpha,
} from '@mui/material';
import {
  ChevronDown,
  ExternalLink,
  Star,
  Clock,
  Tag,
  BookOpen,
  TrendingUp,
  Filter,
  Copy,
  Share,
} from 'lucide-react';
import { TreeNodeData, EngineeringPrinciple, PrincipleCategory, FilterOptions } from '../types';
import { DataTransformUtils } from '../utils/dataTransform';

interface PrincipleDetailsProps {
  node: TreeNodeData | undefined;
  onClose?: () => void;
  showFilters?: boolean;
}

const PrincipleCard: React.FC<{
  principle: EngineeringPrinciple;
  onSelect?: (principle: EngineeringPrinciple) => void;
  isSelected?: boolean;
}> = ({ principle, onSelect, isSelected }) => {
  const theme = useTheme();
  const category = DataTransformUtils.getPrincipleCategory(principle);
  const categoryColor = DataTransformUtils.getCategoryColor(category);

  const handleCopyDescription = () => {
    navigator.clipboard.writeText(principle.description);
  };

  const handleOpenSource = () => {
    window.open(principle.source_url, '_blank');
  };

  return (
    <Card
      sx={{
        mb: 2,
        border: isSelected ? `2px solid ${theme.palette.primary.main}` : '1px solid',
        borderColor: isSelected ? theme.palette.primary.main : theme.palette.divider,
        cursor: onSelect ? 'pointer' : 'default',
        transition: 'all 0.2s ease-in-out',
        '&:hover': onSelect ? {
          borderColor: theme.palette.primary.main,
          transform: 'translateY(-1px)',
          boxShadow: theme.shadows[4],
        } : {},
      }}
      onClick={() => onSelect?.(principle)}
    >
      <CardContent>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
          <Typography variant="h6" sx={{ flex: 1, mr: 2 }}>
            {principle.title}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              label={category}
              size="small"
              sx={{
                backgroundColor: categoryColor,
                color: 'white',
                fontWeight: 500,
              }}
            />
            <Tooltip title={`Confidence: ${(principle.confidence * 100).toFixed(1)}%`}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Star size={16} fill={principle.confidence > 0.7 ? theme.palette.warning.main : 'none'} />
                <Typography variant="caption" color="text.secondary">
                  {(principle.confidence * 100).toFixed(0)}%
                </Typography>
              </Box>
            </Tooltip>
          </Box>
        </Box>

        {/* Confidence Bar */}
        <Box sx={{ mb: 2 }}>
          <LinearProgress
            variant="determinate"
            value={principle.confidence * 100}
            sx={{
              height: 4,
              borderRadius: 2,
              '& .MuiLinearProgress-bar': {
                backgroundColor: principle.confidence > 0.8 
                  ? theme.palette.success.main 
                  : principle.confidence > 0.6 
                    ? theme.palette.warning.main 
                    : theme.palette.error.main,
              },
            }}
          />
        </Box>

        {/* Description */}
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.6 }}>
          {principle.description}
        </Typography>

        {/* Related Terms */}
        {principle.related_terms.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
              <Tag size={12} />
              Related Terms:
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {principle.related_terms.slice(0, 5).map((term, index) => (
                <Chip
                  key={index}
                  label={term}
                  size="small"
                  variant="outlined"
                  sx={{ fontSize: '0.7rem', height: 20 }}
                />
              ))}
              {principle.related_terms.length > 5 && (
                <Tooltip title={`+${principle.related_terms.length - 5} more terms`}>
                  <Chip
                    label={`+${principle.related_terms.length - 5}`}
                    size="small"
                    variant="outlined"
                    sx={{ fontSize: '0.7rem', height: 20 }}
                  />
                </Tooltip>
              )}
            </Box>
          </Box>
        )}
      </CardContent>

      <CardActions sx={{ px: 2, pb: 2 }}>
        <Button
          size="small"
          startIcon={<ExternalLink size={14} />}
          onClick={(e) => {
            e.stopPropagation();
            handleOpenSource();
          }}
        >
          Wikipedia
        </Button>
        <Button
          size="small"
          startIcon={<Copy size={14} />}
          onClick={(e) => {
            e.stopPropagation();
            handleCopyDescription();
          }}
        >
          Copy
        </Button>
      </CardActions>
    </Card>
  );
};

export const PrincipleDetails: React.FC<PrincipleDetailsProps> = ({
  node,
  onClose,
  showFilters = true,
}) => {
  const theme = useTheme();
  const [selectedPrinciple, setSelectedPrinciple] = useState<EngineeringPrinciple | null>(null);
  const [filters, setFilters] = useState<FilterOptions>({
    categories: [],
    minConfidence: 0,
    maxDepth: 10,
    searchText: '',
  });
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['principles', 'stats'])
  );

  const filteredPrinciples = useMemo(() => {
    if (!node) return [];
    return DataTransformUtils.filterPrinciples(node.principles, filters);
  }, [node, filters]);

  const nodeStats = useMemo(() => {
    if (!node) return null;
    return DataTransformUtils.calculateNodeStats(node);
  }, [node]);

  const categoryStats = useMemo(() => {
    if (!node) return [];
    const categories = node.principles.reduce((acc, principle) => {
      const category = DataTransformUtils.getPrincipleCategory(principle);
      if (!acc[category]) {
        acc[category] = { count: 0, totalConfidence: 0 };
      }
      acc[category].count++;
      acc[category].totalConfidence += principle.confidence;
      return acc;
    }, {} as Record<PrincipleCategory, { count: number; totalConfidence: number }>);

    return Object.entries(categories).map(([category, stats]) => ({
      category: category as PrincipleCategory,
      count: stats.count,
      avgConfidence: stats.totalConfidence / stats.count,
      percentage: (stats.count / node.principles.length) * 100,
    })).sort((a, b) => b.count - a.count);
  }, [node]);

  const handleToggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const handleShareNode = () => {
    if (!node) return;
    const shareData = {
      title: `Engineering Analysis: ${node.name}`,
      text: `Found ${node.principles.length} engineering principles for ${node.name}`,
      url: window.location.href,
    };
    
    if (navigator.share) {
      navigator.share(shareData);
    } else {
      navigator.clipboard.writeText(`${shareData.title}\n${shareData.text}\n${shareData.url}`);
    }
  };

  if (!node) {
    return (
      <Paper elevation={2} sx={{ p: 3, textAlign: 'center' }}>
        <BookOpen size={48} color={theme.palette.text.secondary} />
        <Typography variant="h6" color="text.secondary" sx={{ mt: 2 }}>
          Select a node to view principles
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Click on any node in the tree to see its engineering principles and details
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper elevation={2}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: `1px solid ${theme.palette.divider}` }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <BookOpen size={20} />
            {node.name}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <IconButton size="small" onClick={handleShareNode}>
              <Share size={16} />
            </IconButton>
            {onClose && (
              <Button size="small" onClick={onClose}>
                Close
              </Button>
            )}
          </Box>
        </Box>
        
        <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
          <Chip label={`${node.principles.length} Principles`} color="primary" size="small" />
          <Chip label={`Depth ${node.depth}`} variant="outlined" size="small" />
          <Chip 
            label={`${node.processingTime}ms`} 
            variant="outlined" 
            size="small"
            icon={<Clock size={12} />}
          />
        </Box>
      </Box>

      {/* Content */}
      <Box sx={{ maxHeight: '70vh', overflowY: 'auto' }}>
        {/* Statistics */}
        <Accordion 
          expanded={expandedSections.has('stats')} 
          onChange={() => handleToggleSection('stats')}
        >
          <AccordionSummary expandIcon={<ChevronDown />}>
            <Typography variant="subtitle1" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TrendingUp size={16} />
              Statistics
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
              {categoryStats.map(({ category, count, avgConfidence, percentage }) => (
                <Card key={category} variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box
                      sx={{
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        backgroundColor: DataTransformUtils.getCategoryColor(category),
                      }}
                    />
                    {category}
                  </Typography>
                  <Typography variant="h6">{count}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {percentage.toFixed(1)}% • Avg: {(avgConfidence * 100).toFixed(0)}%
                  </Typography>
                </Card>
              ))}
            </Box>
          </AccordionDetails>
        </Accordion>

        {/* Principles */}
        <Accordion 
          expanded={expandedSections.has('principles')} 
          onChange={() => handleToggleSection('principles')}
        >
          <AccordionSummary expandIcon={<ChevronDown />}>
            <Typography variant="subtitle1" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Filter size={16} />
              Engineering Principles ({filteredPrinciples.length})
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            {filteredPrinciples.length === 0 ? (
              <Typography color="text.secondary" textAlign="center" sx={{ py: 4 }}>
                No principles found matching the current filters
              </Typography>
            ) : (
              <Box>
                {filteredPrinciples.map((principle) => (
                  <PrincipleCard
                    key={principle.id}
                    principle={principle}
                    onSelect={setSelectedPrinciple}
                    isSelected={selectedPrinciple?.id === principle.id}
                  />
                ))}
              </Box>
            )}
          </AccordionDetails>
        </Accordion>

        {/* Children Summary */}
        {node.children && node.children.length > 0 && (
          <Accordion 
            expanded={expandedSections.has('children')} 
            onChange={() => handleToggleSection('children')}
          >
            <AccordionSummary expandIcon={<ChevronDown />}>
              <Typography variant="subtitle1">
                Related Concepts ({node.children.length})
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <List dense>
                {node.children.map((child, index) => (
                  <ListItem key={index} sx={{ py: 0.5 }}>
                    <ListItemText
                      primary={child.name}
                      secondary={`${child.principles.length} principles • Depth ${child.depth}`}
                    />
                  </ListItem>
                ))}
              </List>
            </AccordionDetails>
          </Accordion>
        )}
      </Box>
    </Paper>
  );
};