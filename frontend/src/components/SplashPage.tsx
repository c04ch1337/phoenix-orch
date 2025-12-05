import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Flame, SkipForward } from 'lucide-react';

interface SplashPageProps {
  onComplete: () => void;
  duration?: number; // in milliseconds
  onSkip?: () => void;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  velocity: {
    x: number;
    y: number;
  };
}

const SplashPage: React.FC<SplashPageProps> = ({ 
  onComplete, 
  duration = 2800, // default to 2.8 seconds
  onSkip 
}) => {
  const [isExiting, setIsExiting] = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [showSkipTooltip, setShowSkipTooltip] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle splash exit
  const handleExit = useCallback(() => {
    if (!isExiting) {
      setIsExiting(true);
      // Create particle burst effect on exit
      if (!shouldReduceMotion) {
        generateParticles();
      }
      
      // Allow time for exit animation
      setTimeout(() => {
        onComplete();
      }, 600);
    }
  }, [isExiting, shouldReduceMotion, onComplete]);

  // Auto-exit after specified duration
  useEffect(() => {
    const timer = setTimeout(() => {
      handleExit();
    }, duration);
    
    return () => clearTimeout(timer);
  }, [duration, handleExit]);

  // Handle skip button click
  const handleSkip = () => {
    // Save the preference to skip splash in future
    localStorage.setItem('phoenix-splash-preference', 'skip');
    
    if (onSkip) {
      onSkip();
    } else {
      handleExit();
    }
  };

  // Generate particles for the burst effect
  const generateParticles = () => {
    if (!containerRef.current) return;
    
    const centerX = containerRef.current.offsetWidth / 2;
    const centerY = containerRef.current.offsetHeight / 2;
    
    const newParticles = Array.from({ length: 30 }, (_, i) => {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 5;
      const size = 3 + Math.random() * 10;
      
      // Use phoenix flame colors
      const colors = ['#FF4500', '#FF6347', '#FF7F50', '#FFA07A', '#FFFF00'];
      const color = colors[Math.floor(Math.random() * colors.length)];
      
      return {
        id: i,
        x: centerX,
        y: centerY,
        size,
        color,
        velocity: {
          x: Math.cos(angle) * speed,
          y: Math.sin(angle) * speed
        }
      };
    });
    
    setParticles(newParticles);
  };

  // Render particles
  const renderParticles = () => {
    return particles.map((particle) => (
      <motion.div
        key={particle.id}
        initial={{ 
          x: particle.x, 
          y: particle.y, 
          opacity: 1 
        }}
        animate={{ 
          x: particle.x + particle.velocity.x * 100, 
          y: particle.y + particle.velocity.y * 100, 
          opacity: 0 
        }}
        transition={{ 
          duration: 0.8, 
          ease: "easeOut" 
        }}
        style={{
          position: 'absolute',
          width: `${particle.size}px`,
          height: `${particle.size}px`,
          backgroundColor: particle.color,
          borderRadius: '50%'
        }}
      />
    ));
  };

  return (
    <AnimatePresence>
      <motion.div 
        ref={containerRef}
        className="fixed inset-0 flex flex-col items-center justify-center bg-black text-white z-50 overflow-hidden"
        initial={{ opacity: 1 }}
        animate={{ opacity: isExiting ? 0 : 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.6 }}
      >
        {/* Particles for burst effect */}
        {renderParticles()}
        
        <div className="text-center relative">
          {/* Phoenix Flame Animation */}
          <motion.div
            animate={{ 
              scale: isExiting ? [1, 1.2, 0] : [1, 1.05, 1],
              rotateZ: shouldReduceMotion ? 0 : [0, -2, 2, 0]
            }}
            transition={{ 
              duration: 2, 
              repeat: isExiting ? 0 : Infinity,
              repeatType: "reverse"
            }}
            className="mx-auto mb-8"
          >
            <motion.div
              animate={{
                filter: [
                  'drop-shadow(0 0 8px rgba(255,69,0,0.5))',
                  'drop-shadow(0 0 16px rgba(255,69,0,0.7))',
                  'drop-shadow(0 0 8px rgba(255,69,0,0.5))'
                ]
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                repeatType: "reverse"
              }}
            >
              <Flame className="w-32 h-32 text-orange-500" strokeWidth={1.5} />
            </motion.div>
          </motion.div>
          
          {/* Title with animation */}
          <motion.h1 
            className="text-6xl font-bold mb-2"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            <span className="text-white">PHOENIX</span>{' '}
            <motion.span 
              className="text-red-600"
              animate={{ 
                textShadow: [
                  '0 0 10px rgba(255,69,0,0.5)', 
                  '0 0 20px rgba(255,69,0,0.8)', 
                  '0 0 10px rgba(255,69,0,0.5)'
                ] 
              }}
              transition={{ 
                duration: 2, 
                repeat: Infinity, 
                repeatType: "reverse" 
              }}
            >
              ORCH
            </motion.span>
          </motion.h1>
          
          <motion.p 
            className="text-lg text-zinc-400 tracking-widest mb-12"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.5 }}
          >
            THE ASHEN GUARD EDITION
          </motion.p>
          
          {/* Skip button with Neuralink tooltip */}
          <motion.div
            className="absolute top-8 right-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
          >
            <div className="relative">
              <button
                onClick={handleSkip}
                onMouseEnter={() => setShowSkipTooltip(true)}
                onMouseLeave={() => setShowSkipTooltip(false)}
                className="p-2 text-gray-400 hover:text-white transition-colors duration-300 flex items-center"
                aria-label="Skip splash screen"
              >
                <SkipForward className="w-6 h-6" />
                <span className="ml-2 text-sm">Skip</span>
              </button>
              
              {showSkipTooltip && (
                <div className="absolute right-0 top-full mt-2 bg-gray-800 text-white text-xs rounded py-1 px-2 w-48">
                  Neuralink thought bypass activated
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default SplashPage;