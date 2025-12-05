/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './features/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'phoenix': {
          'blood': '#E63946',
          'orange': '#F77F00',
          'orange-light': '#FF9E2C', /* Higher contrast for dark backgrounds */
          'orange-dark': '#C65200',  /* Higher contrast for light backgrounds */
          'yellow': '#FFD23F',
          'void': '#0A0A0A',
          'dried': '#500000',
          'deep': '#330000',
          'alert': '#b91c1c',
          'cyan': '#00CED1',
          'cyan-light': '#40E0E5',
          'cyan-dark': '#008B8B',
        },
        'ashen': {
          'purple': '#8B00FF',
          'void': '#0A0A0A'
        },
        /* Semantic colors with proper contrast ratios */
        'content': {
          'primary': '#0A0A0A',    /* On light backgrounds (16:1) */
          'secondary': '#525252',  /* On light backgrounds (7:1) */
          'primary-dark': '#FFFFFF', /* On dark backgrounds (16:1) */
          'secondary-dark': '#BBBBBB', /* On dark backgrounds (7:1) */
        },
        'focus': {
          'ring': '#F77F00',
          'ring-dark': '#FF9E2C',
        },
      },
      fontFamily: {
        covenant: ['Homemade Apple', 'cursive'],
      },
      fontFeatureSettings: {
        'ss01': '"ss01" on',
        'noliga': '"liga" 0',
      },
      letterSpacing: {
        'tight-orbit': '-0.02em',
      },
      clipPath: {
        'trapezoid-top': 'polygon(10% 0%, 90% 0%, 100% 100%, 0% 100%)',
        'trapezoid-bottom': 'polygon(0% 0%, 100% 0%, 90% 100%, 10% 100%)',
      },
      dropShadow: {
        'glow': '0 0 10px rgba(255,255,255,0.8)',
        'red-glow': '0 0 15px rgba(230, 57, 70, 0.7)',
        'focus': '0 0 3px rgba(247, 127, 0, 0.5)',
        'focus-high-contrast': '0 0 5px rgba(255, 140, 0, 0.8)',
      },
      animation: {
        'fade-in': 'fadeIn 1s ease-in-out',
        'fade-in-reduced': 'fadeIn 0.3s linear',
        'glitch': 'glitch 0.5s cubic-bezier(.25, .46, .45, .94) both infinite',
        'shimmer': 'shimmer 3s linear infinite',
        'shimmer-reduced': 'shimmer 10s linear',
        'pulse-subtle': 'pulseSubtle 2s ease-in-out infinite',
        'pulse-reduced': 'fadeIn 0.5s linear', /* Alternative for reduced motion */
        'breathe': 'breathe 4s ease-in-out infinite',
        'breathe-reduced': 'none', /* No animation for reduced motion */
        'flicker': 'flicker 2s ease-in-out infinite',
        'flicker-reduced': 'none', /* No animation for reduced motion */
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        glitch: {
          '0%, 100%': { transform: 'translate(0)' },
          '33%': { transform: 'translate(-2px, 1px)' },
          '66%': { transform: 'translate(2px, -1px)' },
        },
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.8' },
        },
        breathe: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.02)' },
        },
        flicker: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.8' },
        },
      },
    },
  },
  plugins: [
    function({ addBase, addComponents, addUtilities, matchUtilities, theme }) {
      // Custom scrollbar
      addComponents({
        '.custom-scrollbar': {
          '&::-webkit-scrollbar': {
            width: '8px', /* Wider for better accessibility */
          },
          '&::-webkit-scrollbar-track': {
            backgroundColor: theme('colors.phoenix.void'),
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: 'rgba(247, 127, 0, 0.5)', /* Phoenix orange for brand consistency */
            borderRadius: theme('borderRadius.DEFAULT'),
            '&:hover': {
              backgroundColor: 'rgba(247, 127, 0, 0.7)',
              transition: 'colors',
            },
          },
          /* High contrast mode scrollbar */
          '.high-contrast &::-webkit-scrollbar-thumb': {
            backgroundColor: 'rgba(255, 140, 0, 0.8)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
          },
        },
      });
      
      // Accessibility utility classes
      addUtilities({
        '.focus-ring': {
          outline: '3px solid transparent',
          'outline-offset': '2px',
          'box-shadow': '0 0 0 3px rgba(247, 127, 0, 0.5)',
          'transition': 'box-shadow 0.2s ease-in-out',
        },
        '.focus-ring-high-contrast': {
          outline: '3px solid #FF8C00',
          'outline-offset': '3px',
        },
        '.sr-hint': {
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: '0',
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          'white-space': 'nowrap',
          'border-width': '0',
        },
      });

      // Phoenix Console
      addComponents({
        '.phoenix-console': {
          fontFamily: theme('fontFamily.jetbrains'),
          fontSize: theme('fontSize.sm')[0],
          background: 'linear-gradient(to bottom, rgba(10,10,10,0.95), rgba(10,10,10,0.98))',
          backdropFilter: 'blur(10px)',
        },
      });

      // Digital Twin Panel
      addComponents({
        '.digital-twin-panel': {
          background: 'radial-gradient(circle at center, rgba(230,57,70,0.1) 0%, transparent 70%)',
        },
      });

      // Fire Text Effect
      addComponents({
        '.fire-text': {
          background: 'linear-gradient(90deg, #FFD23F 0%, #F77F00 50%, #E63946 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          animation: theme('animation.shimmer'),
        },
      });

      // Phoenix Rain Canvas
      addComponents({
        'canvas.phoenix-rain': {
          mixBlendMode: 'screen',
          opacity: '0.3',
          transition: 'opacity 0.5s ease-in-out',
          '&.white-hot': {
            opacity: '0.8',
          },
        },
      });

      // Font Utility Classes
      addUtilities({
        '.font-orbitron': {
          fontFeatureSettings: theme('fontFeatureSettings.ss01'),
          letterSpacing: theme('letterSpacing.tight-orbit'),
        },
        '.font-jetbrains': {
          fontFeatureSettings: theme('fontFeatureSettings.noliga'),
          fontVariantLigatures: 'none',
        },
      });

      // Selection styling
      addBase({
        '::selection': {
          backgroundColor: theme('colors.phoenix.orange'),
          color: theme('colors.black'),
        },
        '.dark-mode ::selection': {
          backgroundColor: theme('colors.phoenix.orange-light'),
          color: theme('colors.black'),
        },
        /* Improved focus styles for keyboard users */
        ':focus-visible': {
          outline: `3px solid ${theme('colors.phoenix.orange')}`,
          outlineOffset: '2px',
        },
        '.dark-mode :focus-visible': {
          outline: `3px solid ${theme('colors.phoenix.orange-light')}`,
          outlineOffset: '2px',
        },
        '.high-contrast :focus-visible': {
          outline: '4px solid #FF8C00',
          outlineOffset: '3px',
        },
      });
      
      // Skip link component
      addComponents({
        '.skip-link': {
          position: 'absolute',
          top: '-9999px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: theme('colors.phoenix.orange'),
          color: theme('colors.black'),
          padding: '1rem 2rem',
          zIndex: '100',
          fontWeight: 'bold',
          transition: 'top 0.2s',
          '&:focus': {
            top: '0',
          }
        },
      });
    },
  ],
}