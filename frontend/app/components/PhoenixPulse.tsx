'use client';

import React, { useRef, useEffect } from 'react';
import clsx from 'clsx';

interface PhoenixPulseProps {
  intensity?: number;
  color?: 'red' | 'orange' | 'white';
  className?: string;
}

/**
 * PhoenixPulse - A client-side component that renders a pulsing animation
 * Works offline and complements Phoenix's visual identity
 */
export default function PhoenixPulse({ 
  intensity = 0.5, 
  color = 'red',
  className = ''
}: PhoenixPulseProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Adjust these values based on the intensity parameter
  const particleCount = Math.floor(30 * intensity);
  const maxSize = Math.floor(8 * intensity);
  const maxSpeed = Math.floor(3 * intensity);
  const pulseSpeed = 0.02 * intensity;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let pulse = 0;
    let pulseDirection = 1;

    // Resize canvas to fill the container
    const resizeCanvas = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    
    // Initialize canvas size
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Create particles
    const particles: { x: number; y: number; size: number; speed: number; angle: number }[] = [];
    
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: canvas.width / 2,
        y: canvas.height / 2,
        size: Math.random() * maxSize + 1,
        speed: Math.random() * maxSpeed + 0.5,
        angle: Math.random() * Math.PI * 2
      });
    }

    // Map color string to gradient values
    const getColorValues = () => {
      switch (color) {
        case 'red':
          return {
            inner: '#E63946',
            outer: 'rgba(230, 57, 70, 0)'
          };
        case 'orange':
          return {
            inner: '#F77F00',
            outer: 'rgba(247, 127, 0, 0)'
          };
        case 'white':
          return {
            inner: '#FFFFFF',
            outer: 'rgba(255, 255, 255, 0)'
          };
        default:
          return {
            inner: '#E63946',
            outer: 'rgba(230, 57, 70, 0)'
          };
      }
    };

    // Animation loop
    const animate = () => {
      if (!ctx || !canvas) return;

      // Clear canvas with very transparent black for trail effect
      ctx.fillStyle = 'rgba(10, 10, 10, 0.2)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Update pulse value
      pulse += pulseDirection * pulseSpeed;
      if (pulse > 1 || pulse < 0) {
        pulseDirection *= -1;
      }

      // Center of the effect
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      // Draw center glow with pulsing effect
      const colors = getColorValues();
      const gradientSize = 100 + pulse * 50;
      
      const gradient = ctx.createRadialGradient(
        centerX, centerY, 0, 
        centerX, centerY, gradientSize
      );
      
      gradient.addColorStop(0, colors.inner);
      gradient.addColorStop(1, colors.outer);
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, gradientSize, 0, Math.PI * 2);
      ctx.fill();

      // Draw particles
      particles.forEach(particle => {
        // Move particles outward
        particle.x += Math.cos(particle.angle) * particle.speed;
        particle.y += Math.sin(particle.angle) * particle.speed;

        // Fade out particles based on distance from center
        const distance = Math.sqrt(
          Math.pow(particle.x - centerX, 2) + 
          Math.pow(particle.y - centerY, 2)
        );

        // Render particle only if still visible
        if (distance < canvas.width) {
          // Calculate opacity based on distance (fade out as they move away)
          const opacity = Math.max(0, 1 - (distance / canvas.width));
          
          // Draw the particle
          ctx.globalAlpha = opacity;
          ctx.fillStyle = colors.inner;
          ctx.beginPath();
          ctx.arc(particle.x, particle.y, particle.size * (pulse * 0.5 + 0.5), 0, Math.PI * 2);
          ctx.fill();
          
          // Reset global alpha
          ctx.globalAlpha = 1;
        }
        
        // Reset particles that have moved too far away
        if (
          particle.x < 0 || 
          particle.x > canvas.width || 
          particle.y < 0 || 
          particle.y > canvas.height
        ) {
          particle.x = centerX;
          particle.y = centerY;
          particle.angle = Math.random() * Math.PI * 2;
        }
      });

      // Continue animation loop
      animationFrameId = requestAnimationFrame(animate);
    };

    // Start animation
    animate();

    // Cleanup
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationFrameId);
    };
  }, [intensity, color, maxSize, maxSpeed, particleCount, pulseSpeed]);

  return (
    <canvas
      ref={canvasRef}
      className={clsx(
        "absolute inset-0 w-full h-full pointer-events-none z-0",
        className
      )}
      style={{ mixBlendMode: color === 'white' ? 'screen' : 'normal' }}
    />
  );
}