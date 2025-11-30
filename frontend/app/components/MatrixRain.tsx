import React, { useEffect, useRef } from 'react';
import clsx from 'clsx';

interface MatrixRainProps {
  intensity?: number;
  speed?: number;
}

const MatrixRain: React.FC<MatrixRainProps> = ({ 
  intensity = 0.5,
  speed = 1.0
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Resize to window
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    
    // Set initial canvas size
    resize();
    window.addEventListener('resize', resize);
    
    // Matrix character set (using a cyberpunk-inspired set)
    const chars = 'アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789';
    const fontSize = 14;
    const columns = Math.ceil(canvas.width / fontSize);
    
    // Track positions for each rain drop
    const raindrops = Array(columns).fill(0);
    
    // Adjust the number of active columns based on intensity
    const activeColumns = Math.floor(columns * intensity);
    for (let i = activeColumns; i < columns; i++) {
      raindrops[i] = -100; // These columns won't render
    }
    
    // Animation frame
    const draw = () => {
      // Semi-transparent black to create fade effect
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Draw characters
      ctx.fillStyle = '#ff2a00';
      ctx.font = `${fontSize}px monospace`;
      
      // Update and draw each column
      for (let i = 0; i < activeColumns; i++) {
        // Draw a random character
        const char = chars[Math.floor(Math.random() * chars.length)];
        const x = i * fontSize;
        const y = raindrops[i] * fontSize;
        
        // Slightly vary color for some drops (creating subtle highlights)
        if (Math.random() > 0.97) {
          ctx.fillStyle = '#ff6b4a'; // Lighter red highlight
        } else if (Math.random() > 0.93) {
          ctx.fillStyle = '#aa0000'; // Darker red
        } else {
          ctx.fillStyle = '#ff2a00'; // Default red
        }
        
        ctx.fillText(char, x, y);
        
        // Move drop down or reset if at bottom
        // Adjust speed based on the speed prop
        if (raindrops[i] * fontSize > canvas.height && Math.random() > 0.975) {
          raindrops[i] = 0;
        } else {
          // Make some columns faster than others for natural effect
          const speedVariation = (Math.random() * 0.5 + 0.5) * speed;
          raindrops[i] += speedVariation;
        }
      }
      
      // Schedule next frame
      setTimeout(() => requestAnimationFrame(draw), 30); // ~30fps
    };
    
    // Start animation
    const animationId = requestAnimationFrame(draw);
    
    // Cleanup
    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationId);
    };
  }, [intensity, speed]);
  
  return (
    <canvas
      ref={canvasRef}
      className={clsx(
        "fixed top-0 left-0 w-full h-full pointer-events-none z-0 opacity-15",
        "phoenix-rain" // Using the custom component defined in tailwind.config.js
      )}
    />
  );
};

export default MatrixRain;
