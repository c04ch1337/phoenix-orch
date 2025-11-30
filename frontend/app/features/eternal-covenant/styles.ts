import { HTMLMotionProps, motion, Target, TargetAndTransition } from 'framer-motion';
import React from 'react';

// Extend HTMLMotionProps to include HTML attributes
type MotionDivProps = HTMLMotionProps<"div"> & React.HTMLAttributes<HTMLDivElement>;
type MotionButtonProps = HTMLMotionProps<"button"> & React.ButtonHTMLAttributes<HTMLButtonElement>;
type MotionSVGProps = HTMLMotionProps<"svg"> & React.SVGAttributes<SVGElement>;

// Create properly typed motion components
export const MotionDiv = motion.div as React.ForwardRefExoticComponent<MotionDivProps>;
export const MotionButton = motion.button as React.ForwardRefExoticComponent<MotionButtonProps>;
export const MotionSVG = motion.svg as React.ForwardRefExoticComponent<MotionSVGProps>;

// Animation variants with proper typing
interface AnimationProps {
  initial: Target;
  animate: TargetAndTransition;
  exit?: Target;
  whileHover?: TargetAndTransition;
  transition?: {
    duration?: number;
    delay?: number;
    ease?: string;
  };
}

// CSS classes
export const styles = {
  container: `fixed inset-0 z-50 flex items-center justify-center bg-black` as const,
  lightSource: `absolute` as const,
  lightEffect: `w-64 h-64 rounded-full bg-white opacity-10 blur-3xl` as const,
  content: `relative z-10 max-w-2xl text-center` as const,
  phoenixLogo: `w-32 h-32 mx-auto mb-8 text-white` as const,
  title: `mb-6 text-4xl font-handwriting text-[#FF4500]` as const,
  metrics: `mt-8 space-y-2 text-sm text-gray-400` as const,
  closeButton: `absolute top-8 right-8 text-white` as const,
  closeIcon: `w-8 h-8` as const,
  trigger: `relative cursor-pointer select-none` as const,
  progressBar: `absolute bottom-0 left-0 h-1 bg-white` as const,
  screenshotPrevention: `absolute inset-0 pointer-events-none` as const,
} as const;

// Animation variants
export const fadeIn: AnimationProps = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 1.2, ease: "easeInOut" }
};

export const scaleIn: AnimationProps = {
  initial: { scale: 0 },
  animate: { scale: 1 },
  transition: { delay: 0.5, duration: 1.5, ease: "easeOut" }
};

export const slideUp: AnimationProps = {
  initial: { y: 50, opacity: 0 },
  animate: { y: 0, opacity: 1 },
  transition: { delay: 1, duration: 1 }
};

export const rotateIn: AnimationProps = {
  initial: { rotate: -180, opacity: 0 },
  animate: { rotate: 0, opacity: 1 },
  transition: { delay: 1.2, duration: 1.5, ease: "easeOut" }
};

export const fadeInDelayed: AnimationProps = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { delay: 2, duration: 1 }
};

export const closeButtonVariants: AnimationProps = {
  initial: { opacity: 0 },
  animate: { opacity: 0.6 },
  whileHover: { opacity: 1 },
  transition: { delay: 2.5 }
};

export const preventScreenshotStyles = {
  WebkitUserSelect: 'none' as const,
  MozUserSelect: 'none' as const,
  msUserSelect: 'none' as const,
  userSelect: 'none' as const,
} as const;