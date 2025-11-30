import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

interface Threat {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  timestamp: string;
  source: string;
}

interface Incident {
  id: string;
  threat: Threat;
  status: string;
  actions_taken: string[];
  evidence: any[];
  timestamp: string;
}

interface DefenseMapProps {
  threats: Threat[];
  incidents: Incident[];
}

const severityColors = {
  critical: '#EF4444', // red-500
  high: '#F97316',    // orange-500
  medium: '#EAB308',  // yellow-500
  low: '#3B82F6',     // blue-500
};

export const DefenseMap: React.FC<DefenseMapProps> = ({ threats, incidents }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to match container
    const resizeCanvas = () => {
      const container = canvas.parentElement;
      if (!container) return;
      
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Animation loop
    let animationFrameId: number;
    let particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      color: string;
      alpha: number;
    }> = [];

    const createParticle = (x: number, y: number, color: string) => {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 2 + 1;
      
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: Math.random() * 3 + 2,
        color,
        alpha: 1,
      });
    };

    const animate = () => {
      ctx.fillStyle = 'rgba(17, 24, 39, 0.2)'; // bg-gray-900 with opacity
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw grid
      ctx.strokeStyle = 'rgba(55, 65, 81, 0.3)'; // gray-700 with opacity
      ctx.lineWidth = 1;
      const gridSize = 30;

      for (let x = 0; x < canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }

      for (let y = 0; y < canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // Update and draw particles
      particles = particles.filter(particle => particle.alpha > 0.1);

      particles.forEach(particle => {
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.alpha *= 0.98;

        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        ctx.fillStyle = `${particle.color}${Math.floor(particle.alpha * 255).toString(16).padStart(2, '0')}`;
        ctx.fill();
      });

      // Draw threats
      threats.forEach(threat => {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const color = severityColors[threat.severity];

        // Create particles for active threats
        if (Math.random() < 0.3) {
          createParticle(x, y, color);
        }

        // Draw threat indicator
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // Draw pulse effect
        ctx.beginPath();
        ctx.arc(x, y, 12 + Math.sin(Date.now() / 500) * 4, 0, Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationFrameId);
    };
  }, [threats]);

  return (
    <div className="relative w-full h-full min-h-[400px] bg-gray-900 rounded-lg overflow-hidden">
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
      />
      
      {/* Overlay Stats */}
      <div className="absolute top-4 right-4 bg-gray-800 bg-opacity-90 rounded-lg p-4 space-y-2">
        <div className="text-sm text-gray-300">
          Active Threats: {threats.length}
        </div>
        <div className="text-sm text-gray-300">
          Open Incidents: {incidents.length}
        </div>
        <div className="flex items-center space-x-2">
          {Object.entries(severityColors).map(([severity, color]) => (
            <div key={severity} className="flex items-center space-x-1">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="text-xs text-gray-400 capitalize">
                {severity}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Loading State */}
      {threats.length === 0 && incidents.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="text-gray-500"
          >
            Scanning for threats...
          </motion.div>
        </div>
      )}
    </div>
  );
};