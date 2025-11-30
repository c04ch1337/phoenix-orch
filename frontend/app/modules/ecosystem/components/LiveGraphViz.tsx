"use client";

/**
 * LiveGraphViz Component
 *
 * Real-time D3 visualization of active agents, frameworks, and their connections
 */

import { useEffect, useRef, useState } from 'react';
import { GraphData, GraphNode, GraphEdge, ActiveSpawn, EcosystemPlugin } from '../types';

interface LiveGraphVizProps {
    spawns: ActiveSpawn[];
    plugins: EcosystemPlugin[];
}

export default function LiveGraphViz({ spawns, plugins }: LiveGraphVizProps) {
    const svgRef = useRef<SVGSVGElement>(null);
    const [graphData, setGraphData] = useState<GraphData>({ nodes: [], edges: [] });

    useEffect(() => {
        // Build graph data from active spawns and plugins
        const nodes: GraphNode[] = [
            {
                id: 'phoenix',
                label: 'PHOENIX ORCH',
                type: 'phoenix',
                status: 'active',
                x: 400,
                y: 300,
            },
        ];

        const edges: GraphEdge[] = [];

        // Add framework nodes
        plugins.forEach((plugin, idx) => {
            if (plugin.status === 'online') {
                const angle = (idx * 2 * Math.PI) / plugins.length;
                const radius = 200;
                nodes.push({
                    id: plugin.id,
                    label: plugin.name,
                    type: 'framework',
                    status: plugin.status,
                    x: 400 + radius * Math.cos(angle),
                    y: 300 + radius * Math.sin(angle),
                });
                edges.push({
                    id: `phoenix-${plugin.id}`,
                    source: 'phoenix',
                    target: plugin.id,
                    type: 'routes',
                });
            }
        });

        // Add spawn/agent nodes
        spawns.forEach((spawn) => {
            if (spawn.status === 'active' || spawn.status === 'spawning') {
                const plugin = plugins.find(p => p.name === spawn.framework);
                if (plugin) {
                    const angle = Math.random() * 2 * Math.PI;
                    const radius = 100;
                    nodes.push({
                        id: spawn.spawn_id,
                        label: spawn.task.substring(0, 20) + '...',
                        type: 'agent',
                        status: spawn.status,
                        x: (plugin.id ? 400 : 400) + radius * Math.cos(angle),
                        y: (plugin.id ? 300 : 300) + radius * Math.sin(angle),
                    });
                    if (plugin.id) {
                        edges.push({
                            id: `${plugin.id}-${spawn.spawn_id}`,
                            source: plugin.id,
                            target: spawn.spawn_id,
                            type: 'spawns',
                        });
                    }
                }
            }
        });

        setGraphData({ nodes, edges });
    }, [spawns, plugins]);

    return (
        <div className="border border-red-700/50 rounded-lg p-6 bg-black/50 backdrop-blur-sm h-[500px] relative overflow-hidden">
            <h3 className="text-lg font-bold text-red-600 mb-4">LIVE ECOSYSTEM GRAPH</h3>
            <svg
                ref={svgRef}
                width="100%"
                height="100%"
                className="absolute inset-0"
                viewBox="0 0 800 600"
            >
                {/* Background grid */}
                <defs>
                    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,127,0,0.1)" strokeWidth="1"/>
                    </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />

                {/* Edges */}
                {graphData.edges.map((edge) => {
                    const source = graphData.nodes.find(n => n.id === edge.source);
                    const target = graphData.nodes.find(n => n.id === edge.target);
                    if (!source || !target || !source.x || !source.y || !target.x || !target.y) return null;

                    return (
                        <line
                            key={edge.id}
                            x1={source.x}
                            y1={source.y}
                            x2={target.x}
                            y2={target.y}
                            stroke={edge.type === 'routes' ? '#00FFFF' : '#FF7F00'}
                            strokeWidth="2"
                            opacity="0.5"
                            strokeDasharray={edge.type === 'spawns' ? '5,5' : '0'}
                        />
                    );
                })}

                {/* Nodes */}
                {graphData.nodes.map((node) => {
                    if (!node.x || !node.y) return null;

                    const color = node.type === 'phoenix' 
                        ? '#E63946' 
                        : node.type === 'framework'
                        ? '#00FFFF'
                        : '#FF7F00';

                    return (
                        <g key={node.id}>
                            <circle
                                cx={node.x}
                                cy={node.y}
                                r={node.type === 'phoenix' ? 30 : node.type === 'framework' ? 20 : 10}
                                fill={color}
                                opacity="0.8"
                                className="animate-pulse"
                            />
                            <text
                                x={node.x}
                                y={node.y + (node.type === 'phoenix' ? 45 : 35)}
                                textAnchor="middle"
                                fill="#E5E7EB"
                                fontSize="12"
                                className="font-mono"
                            >
                                {node.label}
                            </text>
                        </g>
                    );
                })}
            </svg>
        </div>
    );
}

