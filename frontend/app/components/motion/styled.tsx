'use client';

import { motion } from 'framer-motion';
import React from 'react';

// Base motion component
export const MotionDiv = motion.div;

// Feather motion component with default styles
export const FeatherMotion = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof motion.div> & { className?: string }
>(({ className = '', ...props }, ref) => (
  <motion.div
    ref={ref}
    className={`absolute z-[20] pointer-events-none ${className}`}
    {...(props as any)}
  />
));
FeatherMotion.displayName = 'FeatherMotion';

// Midnight feather motion component with default styles
export const MidnightFeatherMotion = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof motion.div> & { className?: string }
>(({ className = '', ...props }, ref) => (
  <motion.div
    ref={ref}
    className={`absolute z-[50] pointer-events-none ${className}`}
    {...(props as any)}
  />
));
MidnightFeatherMotion.displayName = 'MidnightFeatherMotion';

// Ash particle motion component with default styles
export const AshParticleMotion = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof motion.div> & { className?: string }
>(({ className = '', ...props }, ref) => (
  <motion.div
    ref={ref}
    className={`absolute w-1 h-1 bg-zinc-500 rounded-full z-[30] ${className}`}
    {...(props as any)}
  />
));
AshParticleMotion.displayName = 'AshParticleMotion';

// Animation variants
export const featherVariants = {
    initial: { opacity: 0, y: -20, x: 0, rotate: 0 },
    animate: { opacity: 1, y: 60, x: 20, rotate: 45 },
    exit: { opacity: 0 }
};

export const midnightFeatherVariants = {
    initial: { opacity: 0, y: -40, x: 0, rotate: -10, scale: 1 },
    animate: { 
        opacity: [0, 1, 1, 0], 
        y: [-40, 60, 140, 180], 
        x: [0, 20, 40, 60], 
        rotate: [-10, 10, 45, 90],
        scale: [1, 1, 0.8, 0],
        color: ["#FFD23F", "#FFD23F", "#E63946", "#330000"]
    }
};

export const ashParticleVariants = {
    initial: { opacity: 1, y: -40 },
    animate: { opacity: 0, y: 60 }
};

export const fadeInOutVariants = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 }
};

export const slideUpVariants = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 }
};
