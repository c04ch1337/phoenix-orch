import React, { ReactNode } from 'react';
import SkipLink from '../common/SkipLink';
import { AccessibilityProvider } from '../../context/AccessibilityContext';
import AccessibilityPanel from '../common/AccessibilityPanel';
import { FocusManager } from '../common/FocusManager';

interface AccessibleLayoutProps {
  children: ReactNode;
  mainId?: string;
  navId?: string;
  skipToContentLabel?: string;
  className?: string;
}

/**
 * AccessibleLayout provides a standard layout with accessibility features
 * 
 * This component wraps your application content and adds:
 * - Skip links for keyboard users
 * - Accessibility settings panel
 * - Focus management
 * - Proper semantic structure
 */
const AccessibleLayout: React.FC<AccessibleLayoutProps> = ({
  children,
  mainId = 'main-content',
  navId = 'main-navigation',
  skipToContentLabel = 'Skip to main content',
  className = '',
}) => {
  return (
    <AccessibilityProvider>
      <FocusManager lockFocus={false}>
        {/* Skip links */}
        <SkipLink targetId={mainId} label={skipToContentLabel} />
        
        {/* Accessibility panel */}
        <AccessibilityPanel />
        
        {/* Application content */}
        <div className={`min-h-screen flex flex-col ${className}`}>
          {children}
        </div>
      </FocusManager>
    </AccessibilityProvider>
  );
};

/**
 * Accessible main content container with proper semantic markup
 */
export const Main: React.FC<{
  id?: string;
  children: ReactNode;
  className?: string;
}> = ({
  id = 'main-content',
  children,
  className = '',
}) => {
  return (
    <main
      id={id}
      className={`flex-grow p-4 ${className}`}
      tabIndex={-1} // Allow programmatic focus but not in tab order
    >
      {children}
    </main>
  );
};

/**
 * Accessible navigation container with proper semantic markup
 */
export const Navigation: React.FC<{
  id?: string;
  children: ReactNode;
  className?: string;
  label?: string;
}> = ({
  id = 'main-navigation',
  children,
  className = '',
  label = 'Main navigation',
}) => {
  return (
    <nav
      id={id}
      aria-label={label}
      className={`p-4 ${className}`}
    >
      {children}
    </nav>
  );
};

/**
 * Accessible section container with proper semantic markup
 */
export const Section: React.FC<{
  id?: string;
  children: ReactNode;
  className?: string;
  title?: string;
  titleAs?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  titleClassName?: string;
  ariaLabel?: string;
}> = ({
  id,
  children,
  className = '',
  title,
  titleAs: TitleComponent = 'h2',
  titleClassName = '',
  ariaLabel,
}) => {
  return (
    <section
      id={id}
      className={`mb-8 ${className}`}
      aria-label={ariaLabel || title}
    >
      {title && (
        <TitleComponent className={`mb-4 ${titleClassName}`}>
          {title}
        </TitleComponent>
      )}
      {children}
    </section>
  );
};

/**
 * Accessible card container for content blocks
 */
export const Card: React.FC<{
  children: ReactNode;
  className?: string;
  isInteractive?: boolean;
}> = ({
  children,
  className = '',
  isInteractive = false,
}) => {
  const baseClasses = 'bg-gray-800 rounded-lg shadow-md p-4';
  const interactiveClasses = isInteractive 
    ? 'transition-transform hover:scale-102 focus-within:ring-2 focus-within:ring-phoenix-orange'
    : '';
  
  return (
    <div className={`${baseClasses} ${interactiveClasses} ${className}`}>
      {children}
    </div>
  );
};

/**
 * Accessible heading with consistent styling
 */
export const Heading: React.FC<{
  children: ReactNode;
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  className?: string;
  id?: string;
}> = ({
  children,
  level = 2,
  className = '',
  id,
}) => {
  const HeadingTag = `h${level}` as keyof JSX.IntrinsicElements;
  
  // Define font sizes based on heading level
  const fontSizeClasses = {
    1: 'text-3xl md:text-4xl',
    2: 'text-2xl md:text-3xl',
    3: 'text-xl md:text-2xl',
    4: 'text-lg md:text-xl',
    5: 'text-base md:text-lg',
    6: 'text-sm md:text-base',
  }[level];
  
  return (
    <HeadingTag 
      id={id}
      className={`font-bold mb-2 ${fontSizeClasses} ${className}`}
    >
      {children}
    </HeadingTag>
  );
};

/**
 * Standardized container for consistent spacing and padding
 */
export const Container: React.FC<{
  children: ReactNode;
  className?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
}> = ({
  children,
  className = '',
  maxWidth = 'xl',
}) => {
  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    full: 'max-w-full',
  }[maxWidth];
  
  return (
    <div className={`w-full mx-auto px-4 ${maxWidthClasses} ${className}`}>
      {children}
    </div>
  );
};

/**
 * Standardized grid layout
 */
export const Grid: React.FC<{
  children: ReactNode;
  className?: string;
  columns?: 1 | 2 | 3 | 4;
  gap?: 'sm' | 'md' | 'lg';
}> = ({
  children,
  className = '',
  columns = 2,
  gap = 'md',
}) => {
  const columnsClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
  }[columns];
  
  const gapClasses = {
    sm: 'gap-2',
    md: 'gap-4',
    lg: 'gap-8',
  }[gap];
  
  return (
    <div className={`grid ${columnsClasses} ${gapClasses} ${className}`}>
      {children}
    </div>
  );
};

/**
 * Standardized flex row layout
 */
export const Row: React.FC<{
  children: ReactNode;
  className?: string;
  align?: 'start' | 'center' | 'end' | 'between' | 'around';
  gap?: 'sm' | 'md' | 'lg';
}> = ({
  children,
  className = '',
  align = 'start',
  gap = 'md',
}) => {
  const alignClasses = {
    start: 'items-start',
    center: 'items-center',
    end: 'items-end',
    between: 'items-center justify-between',
    around: 'items-center justify-around',
  }[align];
  
  const gapClasses = {
    sm: 'gap-2',
    md: 'gap-4',
    lg: 'gap-8',
  }[gap];
  
  return (
    <div className={`flex flex-wrap ${alignClasses} ${gapClasses} ${className}`}>
      {children}
    </div>
  );
};

/**
 * Text component with standardized typography
 */
export const Text: React.FC<{
  children: ReactNode;
  className?: string;
  size?: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl';
  as?: keyof JSX.IntrinsicElements;
}> = ({
  children,
  className = '',
  size = 'base',
  as: Component = 'p',
}) => {
  const sizeClasses = {
    xs: 'text-xs',
    sm: 'text-sm',
    base: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl',
    '2xl': 'text-2xl',
  }[size];
  
  return (
    <Component className={`${sizeClasses} ${className}`}>
      {children}
    </Component>
  );
};

export default AccessibleLayout;