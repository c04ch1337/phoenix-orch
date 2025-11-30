import React from 'react';
import { useHoverTimer } from '../hooks/useHoverTimer';
import { useEternalCovenant } from './EternalCovenantProvider';
import {
  styles,
  MotionDiv,
  MotionSVG,
  preventScreenshotStyles
} from '../styles';

interface EternalCovenantTriggerProps {
  children?: React.ReactNode;
}

export const EternalCovenantTrigger: React.FC<EternalCovenantTriggerProps> = ({ children }) => {
  const { handleMouseEnter, handleMouseLeave, isHovering } = useHoverTimer();
  const { registerClick, state } = useEternalCovenant();

  const hoverTransition = {
    duration: 7,
    ease: "easeInOut"
  };

  return (
    <MotionDiv
      style={{
        position: 'relative',
        cursor: 'pointer',
        userSelect: 'none'
      }}
      onClick={registerClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      animate={{
        color: isHovering ? '#ffffff' : '#FF4500', // blood-orange to white
      }}
      transition={hoverTransition}
    >
      {/* Screenshot Prevention Layer */}
      <div 
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          ...preventScreenshotStyles
        }}
      />

      {/* Content Layer */}
      <div style={{ position: 'relative', zIndex: 10 }}>
        {children || (
          <div style={{
            width: '8rem',
            height: '8rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <MotionSVG
              viewBox="0 0 24 24"
              style={{
                width: '100%',
                height: '100%',
                transform: 'scale(1)',
                transition: 'transform 700ms'
              }}
              fill="currentColor"
            >
              {/* Phoenix Logo Path */}
              <path d="M12 2L9 9l-7 3 7 3 3 7 3-7 7-3-7-3-3-7z" />
            </MotionSVG>
          </div>
        )}
      </div>

      {/* Hover Progress Indicator */}
      {isHovering && (
        <MotionDiv
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            height: '4px',
            backgroundColor: 'white'
          }}
          initial={{ width: '0%' }}
          animate={{ width: '100%' }}
          transition={hoverTransition}
        />
      )}
    </MotionDiv>
  );
};