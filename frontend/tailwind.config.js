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
          'yellow': '#FFD23F',
          'void': '#0A0A0A',
          'dried': '#500000',
          'deep': '#330000',
          'alert': '#b91c1c',
        },
        'ashen': {
          'purple': '#8B00FF',
          'void': '#0A0A0A'
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
      },
      animation: {
        'fade-in': 'fadeIn 1s ease-in-out',
        'glitch': 'glitch 0.5s cubic-bezier(.25, .46, .45, .94) both infinite',
        'shimmer': 'shimmer 3s linear infinite',
        'pulse-subtle': 'pulseSubtle 2s ease-in-out infinite',
        'breathe': 'breathe 4s ease-in-out infinite',
        'flicker': 'flicker 2s ease-in-out infinite',
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
    function({ addBase, addComponents, addUtilities, theme }) {
      // Custom scrollbar
      addComponents({
        '.custom-scrollbar': {
          '&::-webkit-scrollbar': {
            width: '4px',
          },
          '&::-webkit-scrollbar-track': {
            backgroundColor: theme('colors.phoenix.void'),
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: 'rgba(230, 57, 70, 0.3)',
            borderRadius: theme('borderRadius.DEFAULT'),
            '&:hover': {
              backgroundColor: 'rgba(230, 57, 70, 0.5)',
              transition: 'colors',
            },
          },
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
          backgroundColor: theme('colors.phoenix.blood'),
          color: theme('colors.white'),
        },
      });
    },
  ],
}