import React from 'react';

interface SkipLinkProps {
  targetId: string;
  label?: string;
  className?: string;
}

/**
 * SkipLink component for accessibility
 * 
 * This component provides a way for keyboard users to skip navigation
 * and go directly to the main content. It's only visible when focused.
 * 
 * @param targetId - The ID of the element to skip to
 * @param label - The text for the skip link
 * @param className - Additional CSS classes
 */
const SkipLink: React.FC<SkipLinkProps> = ({
  targetId,
  label = 'Skip to main content',
  className = '',
}) => {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    
    // Find the target element
    const target = document.getElementById(targetId);
    if (target) {
      // Set focus to the target
      target.setAttribute('tabindex', '-1');
      target.focus();
      
      // Remove tabindex after blur to keep DOM clean
      target.addEventListener('blur', () => {
        target.removeAttribute('tabindex');
      }, { once: true });
    }
  };
  
  return (
    <a
      href={`#${targetId}`}
      onClick={handleClick}
      className={`skip-link ${className}`}
    >
      {label}
    </a>
  );
};

export default SkipLink;