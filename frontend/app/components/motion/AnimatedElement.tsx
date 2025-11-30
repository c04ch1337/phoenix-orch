'use client';

import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';

type AnimatedElementProps = HTMLMotionProps<"div"> & {
    children: React.ReactNode;
};

export const AnimatedElement: React.FC<AnimatedElementProps> = ({ 
    children, 
    ...motionProps 
}) => {
    return (
        <motion.div {...motionProps}>
            {children}
        </motion.div>
    );
};

// Variants for common animations
export const fadeInOut = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 }
};

export const slideUp = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 }
};

export const featherFloat = {
    initial: { opacity: 0, y: -20, x: 0, rotate: 0 },
    animate: { opacity: 1, y: 60, x: 20, rotate: 45 },
    exit: { opacity: 0 }
};

export const midnightFeather = {
    initial: { opacity: 0, y: -40, x: 0, rotate: -10, scale: 1 },
    animate: { 
        opacity: [0, 1, 1, 0], 
        y: [-40, 60, 140, 180], 
        x: [0, 20, 40, 60], 
        rotate: [-10, 10, 45, 90],
        scale: [1, 1, 0.8, 0]
    }
};

export const ashParticle = {
    initial: { opacity: 1, y: -40 },
    animate: { opacity: 0, y: 60 }
};