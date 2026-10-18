import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { VideoItem, VocabularyItem, CEFRLevel } from '../types';
import { speakEnglish } from '../utils/speech';
import { NativeAudioClipPlayer } from './NativeAudioClipPlayer';
import { GoogleImageGallery } from './GoogleImageGallery';
import {
  Network,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  Search,
  Filter,
  Volume2,
  Play,
  BookOpen,
  Sparkles,
  Layers,
  ChevronRight,
  X,
  Clock,
  Eye,
  CheckCircle,
  HelpCircle
} from 'lucide-react';

interface GraphNode {
  id: string;
  type: 'video' | 'vocab';
  label: string;
  subLabel?: string;
  radius: number;
  color: string;
  glowColor: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  isDragging?: boolean;
  videoData?: VideoItem;
  vocabData?: VocabularyItem;
  cefrLevel?: CEFRLevel;
  srsStatus?: 'new' | 'learning' | 'review' | 'mastered';
  connectedNodeIds: Set<string>;
}

interface GraphLink {
  sourceId: string;
  targetId: string;
  source: GraphNode;
  target: GraphNode;
  distance: number;
  isSuggested?: boolean;
}

interface GraphViewProps {
  videos: VideoItem[];
  vocabularyList: VocabularyItem[];
  onSelectVideoToPlay: (video: VideoItem) => void;
  onAddVocabToSRS: (vocab: VocabularyItem) => void;
  savedVocabIds: Set<string>;
}

export const GraphView: React.FC<GraphViewProps> = ({
  videos,
  vocabularyList,
  onSelectVideoToPlay,
  onAddVocabToSRS,
  savedVocabIds,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Viewport transforms (Pan & Zoom)
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const transformRef = useRef(transform);
  transformRef.current = transform;

  // Obsidian graph settings
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCefr, setFilterCefr] = useState<string>('all');
  const [filterSrs, setFilterSrs] = useState<string>('all');
  const [showLabels, setShowLabels] = useState(true);
  const [includeSuggested, setIncludeSuggested] = useState(true);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);

  // Mouse interaction state
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const draggedNodeRef = useRef<GraphNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isSimulatingRef = useRef(true);

  // Color mapping based on Obsidian / modern palette
  const getCefrColor = (level?: CEFRLevel) => {
    switch (level) {
      case 'A1': return { base: '#38bdf8', glow: 'rgba(56, 189, 248, 0.4)' }; // Sky blue
      case 'A2': return { base: '#fbbf24', glow: 'rgba(251, 191, 36, 0.45)' }; // Amber
      case 'B1': return { base: '#34d399', glow: 'rgba(52, 211, 153, 0.45)' }; // Emerald
      case 'B2': return { base: '#a855f7', glow: 'rgba(168, 85, 247, 0.45)' }; // Purple
      case 'C1': return { base: '#f43f5e', glow: 'rgba(244, 63, 94, 0.45)' }; // Rose
      default: return { base: '#f59e0b', glow: 'rgba(245, 158, 11, 0.4)' };
    }
  };

  const getSrsColor = (status?: string) => {
    switch (status) {
      case 'new': return { base: '#38bdf8', glow: 'rgba(56, 189, 248, 0.5)' };
      case 'learning': return { base: '#f59e0b', glow: 'rgba(245, 158, 11, 0.5)' };
      case 'review': return { base: '#a855f7', glow: 'rgba(168, 85, 247, 0.5)' };
      case 'mastered': return { base: '#10b981', glow: 'rgba(16, 185, 129, 0.5)' };
      default: return { base: '#94a3b8', glow: 'rgba(148, 163, 184, 0.3)' };
    }
  };

  // Build Graph Nodes and Links from Videos and Saved Vocabulary
  const { initialNodes, initialLinks } = useMemo(() => {
    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];
    const nodeMap = new Map<string, GraphNode>();

    const centerX = 400;
    const centerY = 300;
    const videoCount = videos.length;

    // 1. Create Video Nodes
    videos.forEach((video, vIdx) => {
      const angle = (vIdx / Math.max(1, videoCount)) * Math.PI * 2;
      const dist = 180 + (vIdx % 2) * 50;
      const cefrColor = getCefrColor(video.cefrLevel);

      const videoNode: GraphNode = {
        id: `node-vid-${video.id}`,
        type: 'video',
        label: video.title,
        subLabel: `${video.cefrLevel} · ${video.channel}`,
        radius: 20,
        color: cefrColor.base,
        glowColor: cefrColor.glow,
        x: centerX + Math.cos(angle) * dist + (Math.random() - 0.5) * 40,
        y: centerY + Math.sin(angle) * dist + (Math.random() - 0.5) * 40,
        vx: 0,
        vy: 0,
        videoData: video,
        cefrLevel: video.cefrLevel,
        connectedNodeIds: new Set<string>(),
      };

      nodes.push(videoNode);
      nodeMap.set(videoNode.id, videoNode);
    });

    // 2. Create Vocab Nodes from Saved Vocabulary
    const addedVocabIds = new Set<string>();

    vocabularyList.forEach((vocab, vocIdx) => {
      const parentVideo = videos.find(
        (v) => v.id === vocab.videoId || v.youtubeId === vocab.videoId || v.title === vocab.videoTitle
      );
      const parentNodeId = parentVideo ? `node-vid-${parentVideo.id}` : null;
      const parentNode = parentNodeId ? nodeMap.get(parentNodeId) : null;

      const srsColor = getSrsColor(vocab.status);
      const vocabNodeId = `node-voc-${vocab.id}`;
      addedVocabIds.add(vocab.id);

      // Position around parent video or random near center
      const angle = Math.random() * Math.PI * 2;
      const dist = 70 + Math.random() * 50;
      const posX = parentNode ? parentNode.x + Math.cos(angle) * dist : centerX + (Math.random() - 0.5) * 300;
      const posY = parentNode ? parentNode.y + Math.sin(angle) * dist : centerY + (Math.random() - 0.5) * 300;

      const vocabNode: GraphNode = {
        id: vocabNodeId,
        type: 'vocab',
        label: vocab.word,
        subLabel: vocab.definitionEn || vocab.word,
        radius: 10,
        color: srsColor.base,
        glowColor: srsColor.glow,
        x: posX,
        y: posY,
        vx: 0,
        vy: 0,
        vocabData: vocab,
        srsStatus: vocab.status,
        connectedNodeIds: new Set<string>(),
      };

      nodes.push(vocabNode);
      nodeMap.set(vocabNodeId, vocabNode);

      if (parentNode) {
        vocabNode.connectedNodeIds.add(parentNode.id);
        parentNode.connectedNodeIds.add(vocabNode.id);

        links.push({
          sourceId: parentNode.id,
          targetId: vocabNode.id,
          source: parentNode,
          target: vocabNode,
          distance: 75,
          isSuggested: false,
        });
      }
    });

    // 3. Optional: Include suggested vocabularies that haven't been saved yet if toggle is ON
    if (includeSuggested) {
      videos.forEach((video) => {
        const parentNode = nodeMap.get(`node-vid-${video.id}`);
        if (!parentNode) return;

        (video.suggestedVocab || []).forEach((sug) => {
          if (addedVocabIds.has(sug.id) || savedVocabIds.has(sug.id)) return;

          const sugNodeId = `node-sug-${sug.id}`;
          if (nodeMap.has(sugNodeId)) return;

          const angle = Math.random() * Math.PI * 2;
          const dist = 85 + Math.random() * 45;
          const posX = parentNode.x + Math.cos(angle) * dist;
          const posY = parentNode.y + Math.sin(angle) * dist;

          const sugNode: GraphNode = {
            id: sugNodeId,
            type: 'vocab',
            label: sug.word,
            subLabel: `[Gợi ý] ${sug.definitionEn || sug.word}`,
            radius: 8,
            color: '#64748b', // Slate for unsaved/suggested
            glowColor: 'rgba(100, 116, 139, 0.3)',
            x: posX,
            y: posY,
            vx: 0,
            vy: 0,
            vocabData: sug,
            srsStatus: 'new',
            connectedNodeIds: new Set<string>(),
          };

          nodes.push(sugNode);
          nodeMap.set(sugNodeId, sugNode);

          sugNode.connectedNodeIds.add(parentNode.id);
          parentNode.connectedNodeIds.add(sugNode.id);

          links.push({
            sourceId: parentNode.id,
            targetId: sugNode.id,
            source: parentNode,
            target: sugNode,
            distance: 90,
            isSuggested: true,
          });
        });
      });
    }

    return { initialNodes: nodes, initialLinks: links };
  }, [videos, vocabularyList, includeSuggested, savedVocabIds]);

  // Keep a mutable ref of nodes & links for continuous physics simulation
  const graphDataRef = useRef<{ nodes: GraphNode[]; links: GraphLink[] }>({
    nodes: [],
    links: [],
  });

  // Re-sync mutable graph reference on data changes while preserving positions
  useEffect(() => {
    const existingNodeMap = new Map<string, GraphNode>();
    graphDataRef.current.nodes.forEach((n) => existingNodeMap.set(n.id, n));

    const updatedNodes = initialNodes.map((newNode) => {
      const prev = existingNodeMap.get(newNode.id);
      if (prev) {
        return {
          ...newNode,
          x: prev.x,
          y: prev.y,
          vx: prev.vx,
          vy: prev.vy,
        };
      }
      return newNode;
    });

    const nodeLookup = new Map<string, GraphNode>();
    updatedNodes.forEach((n) => nodeLookup.set(n.id, n));

    const updatedLinks = initialLinks
      .map((l) => {
        const s = nodeLookup.get(l.sourceId);
        const t = nodeLookup.get(l.targetId);
        if (!s || !t) return null;
        return {
          ...l,
          source: s,
          target: t,
        };
      })
      .filter(Boolean) as GraphLink[];

    graphDataRef.current = {
      nodes: updatedNodes,
      links: updatedLinks,
    };

    isSimulatingRef.current = true;
  }, [initialNodes, initialLinks]);

  // Force-Directed Physics Simulation Step (Verlet/Euler with Coulomb Repulsion + Hooke Springs)
  const stepSimulation = useCallback(() => {
    const { nodes, links } = graphDataRef.current;
    if (nodes.length === 0) return;

    const canvas = canvasRef.current;
    const width = canvas ? canvas.width : 800;
    const height = canvas ? canvas.height : 600;
    const centerX = width / 2;
    const centerY = height / 2;

    const repulsionStrength = 1800;
    const springConstant = 0.045;
    const centerGravity = 0.008;
    const damping = 0.88;

    // 1. Center gravity & reset velocity for dragged node
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (node.isDragging) continue;

      const dx = centerX - node.x;
      const dy = centerY - node.y;
      node.vx += dx * centerGravity;
      node.vy += dy * centerGravity;
    }

    // 2. Node-node Repulsion (Coulomb)
    for (let i = 0; i < nodes.length; i++) {
      const nodeA = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const nodeB = nodes[j];
        const dx = nodeB.x - nodeA.x;
        const dy = nodeB.y - nodeA.y;
        const distSq = dx * dx + dy * dy + 1;
        const dist = Math.sqrt(distSq);

        if (dist > 350) continue; // Repulsion cutoff for performance

        const force = repulsionStrength / distSq;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        if (!nodeA.isDragging) {
          nodeA.vx -= fx;
          nodeA.vy -= fy;
        }
        if (!nodeB.isDragging) {
          nodeB.vx += fx;
          nodeB.vy += fy;
        }
      }
    }

    // 3. Link Spring Attraction (Hooke)
    for (let i = 0; i < links.length; i++) {
      const link = links[i];
      const source = link.source;
      const target = link.target;

      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const displacement = dist - link.distance;

      const force = displacement * springConstant;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;

      if (!source.isDragging) {
        source.vx += fx;
        source.vy += fy;
      }
      if (!target.isDragging) {
        target.vx -= fx;
        target.vy -= fy;
      }
    }

    // 4. Position update & damping
    let maxMovement = 0;
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (node.isDragging) continue;

      node.vx *= damping;
      node.vy *= damping;

      // Limit max speed
      const speed = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
      if (speed > 12) {
        node.vx = (node.vx / speed) * 12;
        node.vy = (node.vy / speed) * 12;
      }

      node.x += node.vx;
      node.y += node.vy;

      maxMovement = Math.max(maxMovement, Math.abs(node.vx) + Math.abs(node.vy));
    }

    // Stop intense calculation if graph is at equilibrium
    if (maxMovement < 0.05 && !draggedNodeRef.current) {
      isSimulatingRef.current = false;
    }
  }, []);

  // Main Canvas Render Loop (Obsidian Style Aesthetics)
  const drawGraph = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    const { x: panX, y: panY, k: zoom } = transformRef.current;
    const { nodes, links } = graphDataRef.current;

    ctx.clearRect(0, 0, width, height);

    // 1. Draw Obsidian Dot Grid
    ctx.save();
    ctx.fillStyle = '#080c14';
    ctx.fillRect(0, 0, width, height);

    // Subtle background grid dots
    const gridSize = 32 * zoom;
    const startX = (panX % gridSize + gridSize) % gridSize;
    const startY = (panY % gridSize + gridSize) % gridSize;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.035)';
    for (let x = startX; x < width; x += gridSize) {
      for (let y = startY; y < height; y += gridSize) {
        ctx.fillRect(x, y, 1.2, 1.2);
      }
    }
    ctx.restore();

    // 2. Apply Pan & Zoom Transform
    ctx.save();
    ctx.translate(panX, panY);
    ctx.scale(zoom, zoom);

    const activeHoverId = hoveredNode?.id;
    const activeSelectedId = selectedNode?.id;
    const focusId = activeHoverId || activeSelectedId;
    const focusedNode = focusId
      ? nodes.find((n) => n.id === focusId)
      : null;

    // Helper to check if a node matches search / filters
    const isNodeMatched = (node: GraphNode) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesWord = node.label.toLowerCase().includes(q);
        const matchesSub = node.subLabel?.toLowerCase().includes(q);
        if (!matchesWord && !matchesSub) return false;
      }
      if (filterCefr !== 'all') {
        if (node.type === 'video' && node.cefrLevel !== filterCefr) return false;
      }
      if (filterSrs !== 'all') {
        if (node.type === 'vocab' && node.srsStatus !== filterSrs) return false;
      }
      return true;
    };

    // 3. Draw Links (Filaments)
    for (let i = 0; i < links.length; i++) {
      const link = links[i];
      const source = link.source;
      const target = link.target;

      const isConnectedToFocus =
        focusedNode &&
        (source.id === focusedNode.id || target.id === focusedNode.id);

      let alpha = 0.22;
      let lineWidth = 1.2;

      if (focusedNode) {
        if (isConnectedToFocus) {
          alpha = 0.95;
          lineWidth = 2.4;
        } else {
          alpha = 0.04;
        }
      }

      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);

      if (link.isSuggested) {
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = `rgba(148, 163, 184, ${alpha})`;
      } else {
        ctx.setLineDash([]);
        // Linear gradient from source to target
        const grad = ctx.createLinearGradient(source.x, source.y, target.x, target.y);
        grad.addColorStop(0, source.color);
        grad.addColorStop(1, target.color);
        ctx.strokeStyle = isConnectedToFocus ? '#fbbf24' : `rgba(200, 210, 230, ${alpha})`;
      }

      ctx.lineWidth = lineWidth;
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 4. Draw Nodes
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const isMatched = isNodeMatched(node);
      const isFocused = focusedNode && node.id === focusedNode.id;
      const isNeighbor = focusedNode && focusedNode.connectedNodeIds.has(node.id);

      let nodeOpacity = 1;
      if (focusedNode) {
        if (isFocused || isNeighbor) {
          nodeOpacity = 1;
        } else {
          nodeOpacity = 0.15;
        }
      }

      if (!isMatched) {
        nodeOpacity = Math.min(nodeOpacity, 0.15);
      }

      ctx.save();
      ctx.globalAlpha = nodeOpacity;

      // Glow halo on video nodes or focused nodes
      if (node.type === 'video' || isFocused) {
        const glowRadius = node.radius * (isFocused ? 2.2 : 1.7);
        const grad = ctx.createRadialGradient(node.x, node.y, node.radius * 0.4, node.x, node.y, glowRadius);
        grad.addColorStop(0, node.glowColor);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(node.x, node.y, glowRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Outer border circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      ctx.fillStyle = node.color;
      ctx.fill();

      // Inner core circle for video nodes
      if (node.type === 'video') {
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius - 4, 0, Math.PI * 2);
        ctx.fillStyle = '#0f172a';
        ctx.fill();

        // CEFR text inside node
        ctx.fillStyle = node.color;
        ctx.font = 'bold 9px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(node.cefrLevel || 'V', node.x, node.y);
      } else {
        // Vocab node center highlight
        ctx.beginPath();
        ctx.arc(node.x, node.y, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      }

      // Selection ring
      if (selectedNode && selectedNode.id === node.id) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius + 4, 0, Math.PI * 2);
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // 5. Draw Node Labels
      if (showLabels || isFocused || isNeighbor) {
        ctx.font = node.type === 'video' ? 'bold 11px "Plus Jakarta Sans", sans-serif' : '10px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        const labelText = node.label.length > 24 ? node.label.substring(0, 22) + '...' : node.label;
        const textY = node.y + node.radius + 4;

        // Label background pill for crisp readability
        const textWidth = ctx.measureText(labelText).width;
        ctx.fillStyle = 'rgba(10, 15, 26, 0.75)';
        ctx.fillRect(node.x - textWidth / 2 - 4, textY - 1, textWidth + 8, 14);

        ctx.fillStyle = node.type === 'video' ? '#f8fafc' : '#cbd5e1';
        if (isFocused) ctx.fillStyle = '#fbbf24';
        ctx.fillText(labelText, node.x, textY);
      }

      ctx.restore();
    }

    ctx.restore();
  }, [hoveredNode, selectedNode, showLabels, searchQuery, filterCefr, filterSrs]);

  // Animation Frame Loop
  useEffect(() => {
    let isRunning = true;

    const loop = () => {
      if (!isRunning) return;
      if (isSimulatingRef.current || draggedNodeRef.current) {
        stepSimulation();
      }
      drawGraph();
      animationFrameRef.current = requestAnimationFrame(loop);
    };

    animationFrameRef.current = requestAnimationFrame(loop);

    return () => {
      isRunning = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [stepSimulation, drawGraph]);

  // Handle Canvas Resize
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;

      // Center initial transform
      if (transformRef.current.x === 0 && transformRef.current.y === 0) {
        setTransform({
          x: rect.width / 2 - 400,
          y: rect.height / 2 - 300,
          k: 1,
        });
      }
      isSimulatingRef.current = true;
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Helper: Convert client coordinates to graph world coordinates
  const screenToWorld = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    const { x: panX, y: panY, k: zoom } = transformRef.current;
    return {
      x: (px - panX) / zoom,
      y: (py - panY) / zoom,
    };
  }, []);

  // Helper: Find node at screen coordinate
  const getNodeAtPoint = useCallback((worldX: number, worldY: number): GraphNode | null => {
    const { nodes } = graphDataRef.current;
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      const dx = worldX - node.x;
      const dy = worldY - node.y;
      if (dx * dx + dy * dy <= (node.radius + 6) * (node.radius + 6)) {
        return node;
      }
    }
    return null;
  }, []);

  // Mouse / Pointer Event Handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { x: wx, y: wy } = screenToWorld(e.clientX, e.clientY);
    const hitNode = getNodeAtPoint(wx, wy);

    if (hitNode) {
      draggedNodeRef.current = hitNode;
      hitNode.isDragging = true;
      isSimulatingRef.current = true;
      setSelectedNode(hitNode);
    } else {
      isPanningRef.current = true;
      panStartRef.current = {
        x: e.clientX - transform.x,
        y: e.clientY - transform.y,
      };
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { x: wx, y: wy } = screenToWorld(e.clientX, e.clientY);

    if (draggedNodeRef.current) {
      draggedNodeRef.current.x = wx;
      draggedNodeRef.current.y = wy;
      draggedNodeRef.current.vx = 0;
      draggedNodeRef.current.vy = 0;
      isSimulatingRef.current = true;
      return;
    }

    if (isPanningRef.current) {
      setTransform((prev) => ({
        ...prev,
        x: e.clientX - panStartRef.current.x,
        y: e.clientY - panStartRef.current.y,
      }));
      return;
    }

    // Hover detection
    const hitNode = getNodeAtPoint(wx, wy);
    if (hitNode !== hoveredNode) {
      setHoveredNode(hitNode);
    }
  };

  const handlePointerUp = () => {
    if (draggedNodeRef.current) {
      draggedNodeRef.current.isDragging = false;
      draggedNodeRef.current = null;
    }
    isPanningRef.current = false;
  };

  // Wheel Zoom (Zoom around cursor)
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
    const newK = Math.max(0.25, Math.min(3.5, transform.k * zoomFactor));

    setTransform((prev) => ({
      k: newK,
      x: mouseX - (mouseX - prev.x) * (newK / prev.k),
      y: mouseY - (mouseY - prev.y) * (newK / prev.k),
    }));
  };

  // Zoom buttons
  const zoomIn = () => {
    const canvas = canvasRef.current;
    const cx = canvas ? canvas.width / 2 : 400;
    const cy = canvas ? canvas.height / 2 : 300;
    const newK = Math.min(3.5, transform.k * 1.25);
    setTransform((prev) => ({
      k: newK,
      x: cx - (cx - prev.x) * (newK / prev.k),
      y: cy - (cy - prev.y) * (newK / prev.k),
    }));
  };

  const zoomOut = () => {
    const canvas = canvasRef.current;
    const cx = canvas ? canvas.width / 2 : 400;
    const cy = canvas ? canvas.height / 2 : 300;
    const newK = Math.max(0.25, transform.k * 0.8);
    setTransform((prev) => ({
      k: newK,
      x: cx - (cx - prev.x) * (newK / prev.k),
      y: cy - (cy - prev.y) * (newK / prev.k),
    }));
  };

  const resetView = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setTransform({
      x: canvas.width / 2 - 400,
      y: canvas.height / 2 - 300,
      k: 1,
    });
    isSimulatingRef.current = true;
  };

  const shufflePhysics = () => {
    graphDataRef.current.nodes.forEach((n) => {
      n.vx += (Math.random() - 0.5) * 15;
      n.vy += (Math.random() - 0.5) * 15;
    });
    isSimulatingRef.current = true;
  };

  // Stats calculation
  const totalVideos = videos.length;
  const totalSavedVocab = vocabularyList.length;
  const totalLinks = graphDataRef.current.links.length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-amber-400 font-mono mb-1">
            <span>OBSIDIAN KNOWLEDGE GRAPH</span>
            <span aria-hidden="true">·</span>
            <span>COMPREHENSIBLE INPUT CLUSTERS</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white font-['Plus_Jakarta_Sans'] flex items-center gap-2.5">
            <Network className="w-6 h-6 text-amber-400" />
            <span>Đồ Thị Kết Nối Video & Từ Vựng</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Mỗi chấm lớn là một video Comprehensible Input. Các chấm vệ tinh xung quanh là các từ vựng & cụm từ đã được bóc tách và liên kết theo tiến độ lặp lại ngắt quãng (SRS).
          </p>
        </div>

        {/* Stats Pill */}
        <div className="flex items-center gap-3 p-2 bg-slate-900/80 border border-slate-800 rounded-xl text-xs font-mono">
          <div className="flex items-center gap-1.5 text-slate-300">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <span>{totalVideos} Videos</span>
          </div>
          <span className="text-slate-600">·</span>
          <div className="flex items-center gap-1.5 text-slate-300">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            <span>{totalSavedVocab} Từ đã lưu</span>
          </div>
          <span className="text-slate-600">·</span>
          <div className="text-slate-400">{totalLinks} Liên kết</div>
        </div>
      </div>

      {/* Control Bar (Obsidian Style) */}
      <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Left: Search & Filter */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative w-48 sm:w-60">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm video, từ vựng..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-2 text-slate-500 hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* CEFR Filter */}
          <select
            value={filterCefr}
            onChange={(e) => setFilterCefr(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-amber-400 cursor-pointer"
          >
            <option value="all">Tất cả CEFR</option>
            <option value="A1">Trình độ A1</option>
            <option value="A2">Trình độ A2</option>
            <option value="B1">Trình độ B1</option>
            <option value="B2">Trình độ B2</option>
          </select>

          {/* SRS Filter */}
          <select
            value={filterSrs}
            onChange={(e) => setFilterSrs(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-amber-400 cursor-pointer"
          >
            <option value="all">Mọi trạng thái SRS</option>
            <option value="new">Mới lưu (New)</option>
            <option value="learning">Đang học (Learning)</option>
            <option value="review">Cần ôn (Review)</option>
            <option value="mastered">Đã thuộc (Mastered)</option>
          </select>
        </div>

        {/* Right: Toggles & View Actions */}
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={showLabels}
              onChange={(e) => setShowLabels(e.target.checked)}
              className="rounded bg-slate-950 border-slate-800 text-amber-400 focus:ring-0"
            />
            <span>Hiện chữ</span>
          </label>

          <label className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={includeSuggested}
              onChange={(e) => setIncludeSuggested(e.target.checked)}
              className="rounded bg-slate-950 border-slate-800 text-amber-400 focus:ring-0"
            />
            <span>Từ gợi ý</span>
          </label>

          <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800">
            <button
              onClick={zoomIn}
              className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
              title="Phóng to"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={zoomOut}
              className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
              title="Thu nhỏ"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={resetView}
              className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
              title="Căn giữa màn hình"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={shufflePhysics}
              className="p-1.5 text-slate-400 hover:text-amber-400 rounded hover:bg-slate-800 transition-colors"
              title="Kích hoạt lại lực đẩy vật lý"
            >
              <Sparkles className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Interactive Graph Area */}
      <div
        ref={containerRef}
        className="relative w-full h-[620px] bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl"
      >
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onWheel={handleWheel}
          className="w-full h-full cursor-grab active:cursor-grabbing block"
        />

        {/* Hover quick tooltip */}
        {hoveredNode && !draggedNodeRef.current && (
          <div
            className="absolute pointer-events-none z-20 px-3 py-1.5 rounded-lg bg-slate-900/95 border border-slate-700 text-xs shadow-xl backdrop-blur-sm transform -translate-x-1/2 -translate-y-full mb-3"
            style={{
              left: `${hoveredNode.x * transform.k + transform.x}px`,
              top: `${hoveredNode.y * transform.k + transform.y - 12}px`,
            }}
          >
            <div className="font-bold text-white flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: hoveredNode.color }}
              />
              <span>{hoveredNode.label}</span>
              {hoveredNode.cefrLevel && (
                <span className="text-[10px] font-mono px-1 rounded bg-slate-800 text-amber-300">
                  {hoveredNode.cefrLevel}
                </span>
              )}
            </div>
            {hoveredNode.subLabel && (
              <div className="text-[11px] text-slate-400 mt-0.5">{hoveredNode.subLabel}</div>
            )}
          </div>
        )}

        {/* Floating Quick Legend */}
        <div className="absolute bottom-3 left-3 z-10 p-2.5 rounded-xl bg-slate-900/90 border border-slate-800/80 backdrop-blur-md text-[11px] text-slate-400 space-y-1.5 pointer-events-none hidden sm:block">
          <div className="font-semibold text-slate-300 text-[10px] uppercase tracking-wider font-mono">
            Chú thích màu Obsidian:
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <span>Video Hub</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-sky-400" />
              <span>Mới</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>Đang học</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-purple-500" />
              <span>Ôn tập</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Thành thạo</span>
            </span>
          </div>
        </div>

        {/* Selected Node Inspector Drawer (Slide-in on right) */}
        {selectedNode && (
          <div className="absolute top-0 right-0 bottom-0 w-80 sm:w-96 bg-slate-900/95 border-l border-slate-800 shadow-2xl backdrop-blur-md z-30 p-5 overflow-y-auto flex flex-col justify-between animate-in slide-in-from-right duration-200">
            <div>
              {/* Header */}
              <div className="flex items-start justify-between gap-2 pb-4 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: selectedNode.color }}
                  />
                  <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
                    {selectedNode.type === 'video' ? 'Video Comprehensible Input' : 'Thẻ Từ Vựng SRS'}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedNode(null)}
                  className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* VIDEO NODE INSPECTOR */}
              {selectedNode.type === 'video' && selectedNode.videoData && (
                <div className="mt-4 space-y-4">
                  <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-950 border border-slate-800">
                    <img
                      src={selectedNode.videoData.thumbnail}
                      alt={selectedNode.videoData.title}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 text-[10px] text-white font-mono">
                      {selectedNode.videoData.duration}s
                    </span>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 text-xs font-mono text-amber-400 mb-1">
                      <span className="font-bold">{selectedNode.videoData.cefrLevel}</span>
                      <span>·</span>
                      <span className="text-slate-400">{selectedNode.videoData.channel}</span>
                    </div>
                    <h3 className="text-base font-bold text-white leading-snug">
                      {selectedNode.videoData.title}
                    </h3>
                  </div>

                  <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-xs text-slate-300 leading-relaxed">
                    <span className="font-semibold text-slate-400 block mb-0.5">Chủ đề:</span>
                    {selectedNode.videoData.topic}
                    <p className="mt-2 text-slate-400">{selectedNode.videoData.summary}</p>
                  </div>

                  {/* Connected Vocab List */}
                  <div>
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                      <span>Từ vựng liên kết ({selectedNode.videoData.suggestedVocab?.length || 0})</span>
                    </div>

                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {(selectedNode.videoData.suggestedVocab || []).map((v) => {
                        const isSaved = savedVocabIds.has(v.id);
                        return (
                          <div
                            key={v.id}
                            className="p-2 rounded-lg bg-slate-950/80 border border-slate-800 flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => speakEnglish(v.word)}
                                className="text-slate-400 hover:text-amber-400 transition-colors"
                              >
                                <Volume2 className="w-3.5 h-3.5" />
                              </button>
                              <span className="font-bold text-white">{v.word}</span>
                              <span className="text-slate-400 text-[11px] truncate max-w-[120px]">
                                {v.definitionEn || v.word}
                              </span>
                            </div>

                            {!isSaved && (
                              <button
                                onClick={() => onAddVocabToSRS(v)}
                                className="px-2 py-0.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold rounded text-[11px] transition-colors"
                              >
                                + Lưu
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* VOCAB NODE INSPECTOR */}
              {selectedNode.type === 'vocab' && selectedNode.vocabData && (
                <div className="mt-4 space-y-4">
                  {(() => {
                    const parentVideo = videos.find(
                      (v) =>
                        v.id === selectedNode.vocabData?.videoId ||
                        v.youtubeId === selectedNode.vocabData?.videoId ||
                        v.title === selectedNode.vocabData?.videoTitle
                    );
                    return (
                      <div>
                        <div className="flex items-center justify-between gap-3">
                          <h2 className="text-2xl font-extrabold text-white">{selectedNode.vocabData.word}</h2>
                          <NativeAudioClipPlayer video={parentVideo} vocab={selectedNode.vocabData} variant="compact" />
                        </div>
                        <div className="text-xs text-slate-400 font-mono mt-1">
                          {selectedNode.vocabData.phonetic} · <span className="italic">{selectedNode.vocabData.partOfSpeech}</span>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                    <span className="text-[11px] uppercase tracking-wider text-amber-400 font-bold block mb-1">
                      Learner's Definition (English):
                    </span>
                    <div className="text-sm font-semibold text-slate-100 leading-relaxed">
                      {selectedNode.vocabData.definitionEn || selectedNode.vocabData.word}
                    </div>
                  </div>

                  {/* Google Images visual anchor */}
                  <GoogleImageGallery
                    query={selectedNode.vocabData.word}
                    variant="compact"
                  />

                  <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                    <span className="text-[11px] uppercase tracking-wider text-slate-500 font-bold block mb-1">
                      Ngữ cảnh trong video (Context):
                    </span>
                    <div className="text-xs text-slate-300 italic">
                      "{selectedNode.vocabData.contextSentence}"
                    </div>
                  </div>

                  {selectedNode.vocabData.collocations && selectedNode.vocabData.collocations.length > 0 && (
                    <div>
                      <span className="text-[11px] uppercase tracking-wider text-slate-500 font-bold block mb-1.5">
                        Cụm từ đi kèm (Collocations):
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {selectedNode.vocabData.collocations.map((col, idx) => (
                          <span
                            key={idx}
                            className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono"
                          >
                            {col}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* SRS Status */}
                  <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-mono">Trạng thái SRS</span>
                      <span className="font-bold text-amber-400 capitalize">
                        {selectedNode.vocabData.status || 'Mới lưu'}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-400 block text-[10px] uppercase font-mono">Chu kỳ ôn</span>
                      <span className="font-mono text-slate-200">
                        {selectedNode.vocabData.interval || 1} ngày
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Actions */}
            <div className="pt-4 border-t border-slate-800 mt-4">
              {selectedNode.type === 'video' && selectedNode.videoData && (
                <button
                  onClick={() => {
                    if (selectedNode.videoData) onSelectVideoToPlay(selectedNode.videoData);
                  }}
                  className="w-full py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  <Play className="w-3.5 h-3.5 fill-slate-950" />
                  <span>Mở Video & Luyện Tập Ngay</span>
                </button>
              )}

              {selectedNode.type === 'vocab' && selectedNode.vocabData && (
                <div className="space-y-2">
                  {!savedVocabIds.has(selectedNode.vocabData.id) && (
                    <button
                      onClick={() => {
                        if (selectedNode.vocabData) onAddVocabToSRS(selectedNode.vocabData);
                      }}
                      className="w-full py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-xl transition-colors cursor-pointer shadow-sm"
                    >
                      + Lưu Từ Này Vào Sổ SRS
                    </button>
                  )}

                  {(() => {
                    const targetVideo = videos.find(
                      (v) =>
                        v.id === selectedNode.vocabData?.videoId ||
                        v.youtubeId === selectedNode.vocabData?.videoId ||
                        v.title === selectedNode.vocabData?.videoTitle
                    );
                    if (targetVideo) {
                      return (
                        <button
                          onClick={() => onSelectVideoToPlay(targetVideo)}
                          className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl border border-slate-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Play className="w-3 h-3 fill-slate-200" />
                          <span>Xem Video Chứa Từ Này</span>
                        </button>
                      );
                    }
                    return null;
                  })()}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
