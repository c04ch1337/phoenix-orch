/**
 * NotebookLM Styles
 * 
 * Shared styles for the NotebookLM component.
 */

// Container styles
export const containerStyles = {
  base: 'max-w-7xl mx-auto p-4 sm:p-6',
};

// Card styles
export const cardStyles = {
  base: 'border rounded-lg hover:shadow-md transition',
  interactive: 'cursor-pointer hover:border-blue-300',
};

// Button styles
export const buttonStyles = {
  primary: 'px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors',
  secondary: 'px-4 py-2 border border-blue-600 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors',
  icon: 'p-2 rounded-full hover:bg-gray-100 transition',
};

// Typography styles
export const typographyStyles = {
  heading1: 'text-2xl font-bold',
  heading2: 'text-xl font-semibold',
  heading3: 'text-lg font-semibold',
  body: 'text-gray-700',
  small: 'text-sm text-gray-500',
  tiny: 'text-xs text-gray-500',
};

// Tag styles
export const tagStyles = {
  base: 'px-2 py-1 rounded-full text-xs',
  blue: 'bg-blue-100 text-blue-800',
  gray: 'bg-gray-100 text-gray-800',
  importance: {
    high: 'bg-red-100 text-red-800',
    medium: 'bg-yellow-100 text-yellow-800',
    low: 'bg-green-100 text-green-800',
  },
};