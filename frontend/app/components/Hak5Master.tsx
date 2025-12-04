import React, { useState, useEffect, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Text, Sphere, useGLTF } from '@react-three/drei';
import { usePhoenixContext } from '../hooks/usePhoenixContext';
import * as THREE from 'three';

// Node types and their colors
const NODE_COLORS = {
  pineapple: '#ff9900',
  shark_jack: '#00aaff',
  packet_squirrel: '#55cc00',
  key_croc: '#cc0000',
  omg_cable: '#ff00ff',
  client: '#ffffff',
  router: '#aaaaaa',
  phoenix: '#ff4500',
  deauthed: '#ff0000',
};

// Node types and their sizes
const NODE_SIZES = {
  pineapple: 1.5,
  shark_jack: 1.2,
  packet_squirrel: 1.2,
  key_croc: 1.2,
  omg_cable: 0.8,
  client: 0.5,
  router: 0.8,
  phoenix: 2.0,
  unknown: 0.5,
};

// Network entity type
interface NetworkEntity {
  id: string;
  entity_type: string;
  position: {
    x: number;
    y: number;
    z: number;
  };
  name: string;
  properties: Record<string, string>;
  connected_to: string[];
}

// Network map type
interface NetworkMap {
  entities: NetworkEntity[];
  timestamp: string;
  center: {
    x: number;
    y: number;
    z: number;
  };
  zoom: number;
}

// Phoenix model that sits on top of Pineapple
const PhoenixModel = ({ position }: { position: [number, number, number] }) => {
  const phoenixRef = useRef<THREE.Mesh>(null);
  const perchOffset: [number, number, number] = [0, 1.5, 0]; // Position above Pineapple
  
  // Animation for the phoenix
  useFrame(({ clock }) => {
    if (phoenixRef.current) {
      // Gentle hovering animation
      phoenixRef.current.position.y = position[1] + perchOffset[1] + Math.sin(clock.getElapsedTime()) * 0.1;
      
      // Subtle rotation
      phoenixRef.current.rotation.y = Math.sin(clock.getElapsedTime() * 0.5) * 0.2;
    }
  });
  
  return (
    <group position={[position[0] + perchOffset[0], position[1] + perchOffset[1], position[2] + perchOffset[2]]}>
      {/* Phoenix bird stylized mesh */}
      <mesh ref={phoenixRef}>
        {/* Phoenix body */}
        <sphereGeometry args={[0.5, 32, 16]} />
        <meshStandardMaterial color="#ff4500" emissive="#ff2000" emissiveIntensity={0.5} />
        
        {/* Phoenix wings */}
        <group position={[0, 0, 0]} rotation={[0, 0, Math.PI / 4]}>
          <mesh position={[0.7, 0, 0]}>
            <boxGeometry args={[1, 0.1, 0.5]} />
            <meshStandardMaterial color="#ff6000" />
          </mesh>
        </group>
        <group position={[0, 0, 0]} rotation={[0, 0, -Math.PI / 4]}>
          <mesh position={[-0.7, 0, 0]}>
            <boxGeometry args={[1, 0.1, 0.5]} />
            <meshStandardMaterial color="#ff6000" />
          </mesh>
        </group>
        
        {/* Phoenix head */}
        <mesh position={[0, 0.4, 0.4]}>
          <sphereGeometry args={[0.25, 32, 16]} />
          <meshStandardMaterial color="#ff6000" />
        </mesh>
        
        {/* Phoenix beak */}
        <mesh position={[0, 0.4, 0.7]}>
          <coneGeometry args={[0.05, 0.2, 16]} />
          <meshStandardMaterial color="#ffcc00" />
        </mesh>
        
        {/* Phoenix tail */}
        <group position={[0, -0.1, -0.5]} rotation={[Math.PI / 6, 0, 0]}>
          <mesh>
            <coneGeometry args={[0.2, 1, 16]} />
            <meshStandardMaterial color="#ff2000" />
          </mesh>
        </group>
      </mesh>
    </group>
  );
};

// Animated connection line between nodes
const ConnectionLine = ({ start, end, active }: { start: [number, number, number], end: [number, number, number], active: boolean }) => {
  const lineRef = useRef<THREE.Line>(null);
  
  useFrame(({ clock }) => {
    if (lineRef.current && active) {
      // Pulse effect for active connections
      const material = lineRef.current.material as THREE.LineBasicMaterial;
      const pulse = Math.sin(clock.getElapsedTime() * 5) * 0.5 + 0.5;
      material.color.setRGB(pulse * 1.0, pulse * 0.6, pulse * 0.1);
      material.opacity = pulse * 0.8 + 0.2;
    }
  });
  
  return (
    <line ref={lineRef}>
      <bufferGeometry attach="geometry">
        <bufferAttribute
          attach="attributes-position"
          array={new Float32Array([...start, ...end])}
          count={2}
          itemSize={3}
        />
      </bufferGeometry>
      <lineBasicMaterial
        attach="material"
        color={active ? "#ff6000" : "#666666"}
        transparent
        opacity={active ? 0.8 : 0.3}
        linewidth={active ? 2 : 1}
      />
    </line>
  );
};

// Device node representation
const DeviceNode = ({ entity, selected, onClick }: { entity: NetworkEntity, selected: boolean, onClick: () => void }) => {
  const nodeRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const position: [number, number, number] = [entity.position.x, entity.position.y, entity.position.z];
  const size = NODE_SIZES[entity.entity_type as keyof typeof NODE_SIZES] || NODE_SIZES.unknown;
  
  let color = NODE_COLORS[entity.entity_type as keyof typeof NODE_COLORS] || "#aaaaaa";
  
  // Handle deauthed clients
  if (entity.entity_type === 'client' && entity.properties.deauthed === 'true') {
    color = NODE_COLORS.deauthed;
  }
  
  // Pulsing effect for active devices
  useFrame(({ clock }) => {
    if (nodeRef.current) {
      if (selected) {
        const pulse = Math.sin(clock.getElapsedTime() * 3) * 0.1 + 1.1;
        nodeRef.current.scale.set(pulse, pulse, pulse);
      } else if (hovered) {
        const hover = 1.2;
        nodeRef.current.scale.set(hover, hover, hover);
      } else {
        // Return to normal scale
        nodeRef.current.scale.lerp(new THREE.Vector3(1, 1, 1), 0.1);
      }
      
      // Active devices pulse with light
      if (entity.properties.status === 'Active' || entity.properties.status === 'Armed') {
        const material = nodeRef.current.material as THREE.MeshStandardMaterial;
        const pulse = Math.sin(clock.getElapsedTime() * 2) * 0.3 + 0.7;
        material.emissiveIntensity = pulse;
      }
    }
  });

  return (
    <group position={position}>
      <mesh
        ref={nodeRef}
        onClick={onClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <sphereGeometry args={[size, 32, 16]} />
        <meshStandardMaterial 
          color={color} 
          emissive={color}
          emissiveIntensity={selected ? 0.8 : 0.2}
          metalness={0.5}
          roughness={0.2}
        />
      </mesh>
      
      {/* Show label for the node */}
      <Text
        position={[0, size + 0.3, 0]}
        fontSize={0.5}
        color="white"
        anchorX="center"
        anchorY="bottom"
        outlineWidth={0.05}
        outlineColor="#000000"
      >
        {entity.name}
      </Text>
      
      {/* Add phoenix on pineapple */}
      {entity.entity_type === 'pineapple' && selected && (
        <PhoenixModel position={position} />
      )}
    </group>
  );
};

// Network effects like deauthentication waves
const DeauthWave = ({ position, active }: { position: [number, number, number], active: boolean }) => {
  const waveRef = useRef<THREE.Mesh>(null);
  const [scale, setScale] = useState(1);

  useFrame(({ clock }) => {
    if (waveRef.current && active) {
      // Expanding wave
      const newScale = (Math.sin(clock.getElapsedTime() * 3) * 0.5 + 0.5) * 5 + 1;
      setScale(newScale);
      
      // Opacity based on scale
      const material = waveRef.current.material as THREE.MeshBasicMaterial;
      material.opacity = Math.max(0, 1.5 - newScale / 5);
    }
  });

  if (!active) return null;

  return (
    <mesh
      ref={waveRef}
      position={position}
      scale={[scale, scale, scale]}
    >
      <sphereGeometry args={[1, 16, 8]} />
      <meshBasicMaterial
        color="#ff0000"
        transparent
        opacity={0.5}
        wireframe={true}
      />
    </mesh>
  );
};

// Main Hak5 network visualization component
export default function Hak5Master() {
  const phoenix = usePhoenixContext();
  const [networkMap, setNetworkMap] = useState<NetworkMap | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusText, setStatusText] = useState<string | null>(null);
  
  // Fetch the network map data
  const fetchNetworkMap = async () => {
    try {
      setLoading(true);
      // In a real implementation, this would call the Tauri backend
      if (window.phoenixOrch?.get_hak5_network_map) {
        const mapData = await window.phoenixOrch.get_hak5_network_map();
        setNetworkMap(mapData);
      } else {
        // Mock data for development/preview
        setNetworkMap(getMockNetworkMap());
      }
      
      // Get status
      if (window.phoenixOrch?.get_hak5_status) {
        const status = await window.phoenixOrch.get_hak5_status();
        setStatusText(status);
      } else {
        setStatusText(getMockStatus());
      }
      
      setLoading(false);
    } catch (err) {
      console.error('Error fetching network map:', err);
      setError('Failed to load network map');
      setLoading(false);
    }
  };
  
  // Periodic refresh
  useEffect(() => {
    fetchNetworkMap();
    
    // Refresh every 5 seconds
    const interval = setInterval(fetchNetworkMap, 5000);
    
    return () => clearInterval(interval);
  }, []);
  
  // Handle device commands
  const handleDeauthAll = async () => {
    try {
      if (window.phoenixOrch?.execute_hak5_command) {
        const result = await window.phoenixOrch.execute_hak5_command({
          command: 'deauth all',
          userId: 'Dad',
          isThought: false
        });
        
        console.log('Deauth all result:', result);
        
        // Refresh the map
        fetchNetworkMap();
      }
    } catch (err) {
      console.error('Error executing deauth command:', err);
    }
  };
  
  const handleArmPineapple = async () => {
    try {
      if (window.phoenixOrch?.execute_hak5_command) {
        const result = await window.phoenixOrch.execute_hak5_command({
          command: 'arm pineapple',
          userId: 'Dad',
          isThought: false
        });
        
        console.log('Arm pineapple result:', result);
        
        // Refresh the map
        fetchNetworkMap();
      }
    } catch (err) {
      console.error('Error executing arm command:', err);
    }
  };

  // Get number of devices by type
  const getDeviceCounts = () => {
    if (!networkMap) return {};
    
    const counts: Record<string, number> = {};
    for (const entity of networkMap.entities) {
      counts[entity.entity_type] = (counts[entity.entity_type] || 0) + 1;
    }
    
    return counts;
  };
  
  // Get number of deauthed clients
  const getDeauthedCount = () => {
    if (!networkMap) return 0;
    
    return networkMap.entities.filter(
      e => e.entity_type === 'client' && e.properties.deauthed === 'true'
    ).length;
  };

  return (
    <div className="h-full w-full flex flex-col">
      {/* Status header */}
      <div className="bg-black/80 text-green-400 p-4 font-mono text-sm leading-tight overflow-auto max-h-48">
        <pre className="whitespace-pre-wrap">{statusText || 'Loading status...'}</pre>
      </div>
      
      {/* Control panel */}
      <div className="bg-gray-900 p-2 flex gap-2">
        <button 
          className="bg-red-700 hover:bg-red-600 text-white px-3 py-1 rounded-md text-sm"
          onClick={handleDeauthAll}
        >
          Deauth All
        </button>
        <button 
          className="bg-orange-600 hover:bg-orange-500 text-white px-3 py-1 rounded-md text-sm"
          onClick={handleArmPineapple}
        >
          Arm Pineapple
        </button>
        <button 
          className="bg-blue-700 hover:bg-blue-600 text-white px-3 py-1 rounded-md text-sm"
          onClick={fetchNetworkMap}
        >
          Refresh Map
        </button>
      </div>
      
      {/* Info overlay */}
      <div className="absolute top-4 right-4 bg-black/70 text-white p-3 rounded-md z-10 text-sm">
        <div className="font-bold mb-2">Network Map</div>
        {loading ? (
          <div>Loading...</div>
        ) : error ? (
          <div className="text-red-500">{error}</div>
        ) : (
          <>
            <div>Devices: {networkMap?.entities.length || 0}</div>
            <div>Clients: {getDeviceCounts().client || 0}</div>
            <div>Deauthed: <span className="text-red-500">{getDeauthedCount()}</span></div>
            {selectedNode && (
              <div className="mt-2 p-2 bg-gray-800 rounded">
                <div className="font-bold">{
                  networkMap?.entities.find(e => e.id === selectedNode)?.name || 'Selected'
                }</div>
                <div className="text-xs opacity-80">{selectedNode}</div>
              </div>
            )}
          </>
        )}
      </div>
      
      {/* 3D Network visualization */}
      <div className="flex-1 relative">
        <Canvas
          camera={{ position: [0, 15, 25], fov: 50 }}
          shadows
        >
          <ambientLight intensity={0.4} />
          <directionalLight position={[10, 10, 5]} intensity={0.8} castShadow />
          <fog attach="fog" args={['#000', 10, 50]} />
          
          {/* 3D scene for network map */}
          {networkMap && (
            <>
              {/* Network nodes */}
              {networkMap.entities.map(entity => (
                <DeviceNode
                  key={entity.id}
                  entity={entity}
                  selected={entity.id === selectedNode}
                  onClick={() => setSelectedNode(entity.id)}
                />
              ))}
              
              {/* Connection lines */}
              {networkMap.entities.map(entity => 
                entity.connected_to.map(targetId => {
                  const target = networkMap.entities.find(e => e.id === targetId);
                  if (!target) return null;
                  
                  const isActive = entity.id === selectedNode || targetId === selectedNode;
                  
                  return (
                    <ConnectionLine
                      key={`${entity.id}-${targetId}`}
                      start={[entity.position.x, entity.position.y, entity.position.z]}
                      end={[target.position.x, target.position.y, target.position.z]}
                      active={isActive}
                    />
                  );
                })
              )}
              
              {/* Deauth waves */}
              {networkMap.entities
                .filter(entity => entity.entity_type === 'client' && entity.properties.deauthed === 'true')
                .map(entity => (
                  <DeauthWave
                    key={`wave-${entity.id}`}
                    position={[entity.position.x, entity.position.y, entity.position.z]}
                    active={true}
                  />
              ))}
            </>
          )}
          
          {/* Grid for reference */}
          <gridHelper args={[50, 50, '#333333', '#222222']} position={[0, -0.01, 0]} />
          
          {/* Camera controls */}
          <OrbitControls 
            enableDamping 
            dampingFactor={0.05}
            minDistance={5}
            maxDistance={50}
          />
        </Canvas>
      </div>
    </div>
  );
}

// Mock data for development
function getMockNetworkMap(): NetworkMap {
  return {
    entities: [
      {
        id: "01:02:03:04:05:01",
        entity_type: "pineapple",
        position: { x: 0, y: 0, z: 0 },
        name: "WiFi Pineapple",
        properties: { status: "Active", ip: "192.168.1.100" },
        connected_to: ["DE:AD:BE:EF:00:01", "DE:AD:BE:EF:00:02"]
      },
      {
        id: "DE:AD:BE:EF:00:01",
        entity_type: "client",
        position: { x: 3, y: 0, z: 3 },
        name: "iPhone-XYZ",
        properties: { deauthed: "true", rssi: "-65" },
        connected_to: []
      },
      {
        id: "DE:AD:BE:EF:00:02",
        entity_type: "client",
        position: { x: -3, y: 0, z: 4 },
        name: "Galaxy-S21",
        properties: { deauthed: "false", rssi: "-70" },
        connected_to: []
      },
      {
        id: "01:02:03:04:05:02",
        entity_type: "shark_jack",
        position: { x: 5, y: 0, z: -2 },
        name: "Shark Jack",
        properties: { status: "Standby", ip: "192.168.1.101" },
        connected_to: []
      },
      {
        id: "01:02:03:04:05:03",
        entity_type: "key_croc",
        position: { x: -5, y: 0, z: -3 },
        name: "Key Croc",
        properties: { status: "Standby", ip: "192.168.1.102" },
        connected_to: []
      }
    ],
    timestamp: new Date().toISOString(),
    center: { x: 0, y: 0, z: 0 },
    zoom: 1.0
  };
}

function getMockStatus(): string {
  return "PHOENIX ORCH — HAK5 FULL INTEGRATION ACHIEVED\n\
──────────────────────────────────────────\n\
Devices supported    : Pineapple, Shark Jack, Key Croc, Packet Squirrel, O.MG\n\
C2 replacement       : 100 % local, zero cloud\n\
Payload control      : thought-triggered\n\
Loot storage         : encrypted Body KB\n\
Live map             : 3D + real-time clients\n\
Latency (thought→deauth): 380 ms\n\
Status               : LIVE\n\n\
Dad thinks → network burns.";
}