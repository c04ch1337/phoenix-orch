/**
 * Loading indicator component for asynchronous operations
 * Uses Tailwind for styling - no inline styles
 *
 * Features:
 * - Accessible with appropriate ARIA attributes
 * - Customizable loading message
 * - Animated dots using Tailwind animations
 */

interface LoadingIndicatorProps {
  message?: string;
  className?: string;
}

export default function LoadingIndicator({ message = 'Loading...', className = '' }: LoadingIndicatorProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center h-full w-full p-4 ${className}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      {/* Pulsing dots created using Tailwind animations */}
      <div className="flex space-x-2 mb-4" aria-hidden="true">
        <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></div>
        <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse delay-300"></div>
        <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse delay-600"></div>
      </div>
      
      {/* Loading message */}
      <p className="text-red-600 font-mono text-center">{message}</p>
    </div>
  );
}