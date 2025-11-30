/**
 * MatrixRain component - creates a Matrix-style rain effect
 * Implemented with Canvas and managed with React hooks
 * Uses only Tailwind for styling - no inline styles
 *
 * Features:
 * - Customizable intensity and speed
 * - Performance optimized
 * - Accessible (non-essential, decorative)
 */

import { useRef, useEffect } from 'react';

interface MatrixRainProps {
  intensity?: number; // 0.0 to 1.0 - density of rain
  speed?: number;     // Multiplier for rain speed
  className?: string;
}

export default function MatrixRain({ 
  intensity = 0.5, 
  speed = 1.0, 
  className = '' 
}: MatrixRainProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Effect to check if reduced motion is preferred
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mediaQuery.matches) {
      // If reduced motion is preferred, we could disable animation or reduce effects
      // For now we'll still render but could add a parameter to control this
    }
  }, []);
  
  // Setup canvas and animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set canvas to full size of container
    const resizeCanvas = () => {
      if (!canvas) return;
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    
    // Initial sizing
    resizeCanvas();
    
    // Handle resize
    window.addEventListener('resize', resizeCanvas);
    
    // Create matrix characters
    const characters = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789';
    
    // Column settings
    const fontSize = 14;
    const columns = Math.floor(canvas.width / fontSize * (intensity + 0.5));
    
    // Set up drops - initial position of each drop (initialized above canvas)
    const drops: number[] = [];
    for (let i = 0; i < columns; i++) {
      drops[i] = -Math.random() * 100;
    }
    
    // Render loop
    let animationId: number;
    
    const draw = () => {
      // Add semi-transparency to show previous frame trail
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Set text style
      ctx.fillStyle = '#0F0';
      ctx.font = `${fontSize}px monospace`;
      ctx.textAlign = 'center';
      
      // Draw each drop
      for (let i = 0; i < drops.length; i++) {
        // Select a random character
        const char = characters[Math.floor(Math.random() * characters.length)];
        
        // X coordinate for the drop
        const x = i * fontSize;
        
        // Y coordinate (top to bottom)
        const y = drops[i] * fontSize;
        
        // Draw character
        if (y >= 0) { // Only draw when visible
          ctx.fillText(char, x, y);
        }
        
        // Randomly determine which drops move in the current frame
        // Adjust with intensity and speed
        if (Math.random() < 0.975 * speed) {
          drops[i]++;
        }
        
        // Reset drop when it reaches bottom
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
          drops[i] = -Math.random() * 10;
        }
      }
      
      // Next frame
      animationId = requestAnimationFrame(draw);
    };
    
    // Start animation
    draw();
    
    // Cleanup
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationId);
    };
  }, [intensity, speed]); // Re-run if props change
  
  return (
    <canvas
      ref={canvasRef}
      className={`w-full h-full ${className}`}
      aria-hidden="true"
      role="presentation"
      title="Matrix-style animation effect (decorative)"
    />
  );
}