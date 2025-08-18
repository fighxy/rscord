/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Enhanced Discord-inspired palette
        discord: {
          darker: '#1a1d21',
          dark: '#2b2d31',
          'lighter-dark': '#35373c',
          light: '#404249',
          blurple: '#5865f2',
          green: '#23a55a',
          yellow: '#f0b232',
          fuchsia: '#eb459e',
          red: '#da373c',
          orange: '#e8710a',
        },
        
        // Modern glassmorphism palette
        glass: {
          'white-5': 'rgba(255, 255, 255, 0.05)',
          'white-10': 'rgba(255, 255, 255, 0.1)',
          'white-15': 'rgba(255, 255, 255, 0.15)',
          'white-20': 'rgba(255, 255, 255, 0.2)',
          'black-5': 'rgba(0, 0, 0, 0.05)',
          'black-10': 'rgba(0, 0, 0, 0.1)',
          'black-20': 'rgba(0, 0, 0, 0.2)',
          'black-30': 'rgba(0, 0, 0, 0.3)',
        },
        
        // Semantic color system
        background: {
          primary: '#1e1f22',
          secondary: '#2b2d31',
          'secondary-alt': '#313338',
          tertiary: '#383a40',
          accent: '#4e5058',
          floating: '#111214',
          overlay: 'rgba(0, 0, 0, 0.85)',
        },
        
        text: {
          primary: '#f2f3f5',
          secondary: '#b5bac1',
          muted: '#80848e',
          disabled: '#6d6f78',
          link: '#00a8fc',
          'link-hover': '#00c9fd',
        },
        
        interactive: {
          normal: '#b5bac1',
          hover: '#dbdee1',
          active: '#f2f3f5',
          muted: '#4e5058',
          disabled: '#6d6f78',
        },
        
        // Status colors
        status: {
          online: '#23a55a',
          idle: '#f0b232',
          dnd: '#da373c',
          offline: '#80848e',
          streaming: '#593695',
        },
        
        // Modern accent colors
        accent: {
          blue: '#3b82f6',
          purple: '#8b5cf6',
          pink: '#ec4899',
          green: '#10b981',
          orange: '#f97316',
          red: '#ef4444',
          yellow: '#eab308',
        },
      },
      
      fontFamily: {
        // Modern font stack inspired by Anthropic
        sans: [
          'Inter Variable',
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI Variable',
          'Segoe UI',
          'system-ui',
          'ui-sans-serif',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        mono: [
          'JetBrains Mono Variable',
          'JetBrains Mono',
          'Fira Code Variable',
          'Fira Code',
          'SF Mono',
          'Cascadia Code',
          'Roboto Mono',
          'Consolas',
          'Monaco',
          'monospace',
        ],
        display: [
          'Cal Sans',
          'Inter Variable',
          'Inter',
          'system-ui',
          'sans-serif',
        ],
      },
      
      fontSize: {
        // Enhanced typography scale
        'xs': ['0.75rem', { lineHeight: '1rem', letterSpacing: '0.025em' }],
        'sm': ['0.875rem', { lineHeight: '1.25rem', letterSpacing: '0.0125em' }],
        'base': ['1rem', { lineHeight: '1.5rem', letterSpacing: '0em' }],
        'lg': ['1.125rem', { lineHeight: '1.75rem', letterSpacing: '-0.0125em' }],
        'xl': ['1.25rem', { lineHeight: '1.875rem', letterSpacing: '-0.025em' }],
        '2xl': ['1.5rem', { lineHeight: '2rem', letterSpacing: '-0.025em' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem', letterSpacing: '-0.025em' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem', letterSpacing: '-0.025em' }],
        '5xl': ['3rem', { lineHeight: '1', letterSpacing: '-0.025em' }],
        '6xl': ['3.75rem', { lineHeight: '1', letterSpacing: '-0.025em' }],
      },
      
      spacing: {
        '18': '4.5rem',
        '72': '18rem',
        '84': '21rem',
        '96': '24rem',
        '108': '27rem',
        '120': '30rem',
      },
      
      borderRadius: {
        'none': '0',
        'sm': '0.375rem',
        'default': '0.5rem',
        'md': '0.75rem',
        'lg': '1rem',
        'xl': '1.5rem',
        '2xl': '2rem',
        '3xl': '3rem',
        'full': '9999px',
      },
      
      backdropBlur: {
        'xs': '2px',
        'sm': '4px',
        'md': '8px',
        'lg': '16px',
        'xl': '24px',
        '2xl': '40px',
        '3xl': '64px',
      },
      
      animation: {
        // Enhanced animations
        'fade-in': 'fadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'fade-out': 'fadeOut 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-down': 'slideDown 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-left': 'slideLeft 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-right': 'slideRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'scale-in': 'scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        'scale-out': 'scaleOut 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
        'discord-pulse': 'discordPulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glass-shine': 'glassShine 3s cubic-bezier(0.4, 0, 0.2, 1) infinite',
        'voice-wave': 'voiceWave 1.5s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'pulse-ring': 'pulseRing 2s cubic-bezier(0.455, 0.03, 0.515, 0.955) infinite',
        'shimmer': 'shimmer 2s linear infinite',
      },
      
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeOut: {
          '0%': { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(-8px)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideLeft: {
          '0%': { opacity: '0', transform: 'translateX(24px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideRight: {
          '0%': { opacity: '0', transform: 'translateX(-24px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        scaleOut: {
          '0%': { opacity: '1', transform: 'scale(1)' },
          '100%': { opacity: '0', transform: 'scale(0.95)' },
        },
        discordPulse: {
          '0%, 70%, 100%': { transform: 'scale(1)', opacity: '1' },
          '35%': { transform: 'scale(0.85)', opacity: '0.7' },
        },
        glassShine: {
          '0%': { transform: 'translateX(-100%) skewX(-15deg)', opacity: '0' },
          '50%': { opacity: '1' },
          '100%': { transform: 'translateX(200%) skewX(-15deg)', opacity: '0' },
        },
        voiceWave: {
          '0%, 100%': { transform: 'scaleY(1)' },
          '50%': { transform: 'scaleY(1.5)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        glow: {
          '0%': { boxShadow: '0 0 20px rgba(59, 130, 246, 0.5)' },
          '100%': { boxShadow: '0 0 30px rgba(59, 130, 246, 0.8)' },
        },
        pulseRing: {
          '0%': { transform: 'scale(0.33)', opacity: '1' },
          '80%, 100%': { transform: 'scale(2.33)', opacity: '0' },
        },
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
      },
      
      boxShadow: {
        // Enhanced shadow system
        'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
        'glass-lg': '0 25px 45px -12px rgba(0, 0, 0, 0.25)',
        'glass-xl': '0 35px 60px -12px rgba(0, 0, 0, 0.35)',
        'glow': '0 0 20px rgba(59, 130, 246, 0.5)',
        'glow-lg': '0 0 40px rgba(59, 130, 246, 0.6)',
        'inner-glass': 'inset 0 2px 4px 0 rgba(255, 255, 255, 0.1)',
        'voice': '0 0 0 4px rgba(34, 197, 94, 0.3)',
        'muted': '0 0 0 4px rgba(239, 68, 68, 0.3)',
      },
      
      gradientColorStops: {
        // Glassmorphism gradients
        'glass-start': 'rgba(255, 255, 255, 0.15)',
        'glass-end': 'rgba(255, 255, 255, 0.05)',
        'glass-dark-start': 'rgba(0, 0, 0, 0.2)',
        'glass-dark-end': 'rgba(0, 0, 0, 0.05)',
      },
      
      backgroundImage: {
        // Custom gradients
        'glass-gradient': 'linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05))',
        'glass-dark-gradient': 'linear-gradient(135deg, rgba(0, 0, 0, 0.2), rgba(0, 0, 0, 0.05))',
        'mesh-gradient': 'radial-gradient(at 40% 20%, hsla(228, 100%, 74%, 1) 0px, transparent 50%), radial-gradient(at 80% 0%, hsla(189, 100%, 56%, 1) 0px, transparent 50%), radial-gradient(at 0% 50%, hsla(355, 100%, 93%, 1) 0px, transparent 50%), radial-gradient(at 80% 50%, hsla(340, 100%, 76%, 1) 0px, transparent 50%), radial-gradient(at 0% 100%, hsla(22, 100%, 77%, 1) 0px, transparent 50%), radial-gradient(at 80% 100%, hsla(242, 100%, 70%, 1) 0px, transparent 50%), radial-gradient(at 0% 0%, hsla(343, 100%, 76%, 1) 0px, transparent 50%)',
        'voice-gradient': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        'muted-gradient': 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      },
    },
  },
  plugins: [
    // Custom utilities for glassmorphism
    function({ addUtilities }) {
      const newUtilities = {
        '.glass': {
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        },
        '.glass-dark': {
          background: 'rgba(0, 0, 0, 0.2)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        },
        '.glass-strong': {
          background: 'rgba(255, 255, 255, 0.15)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
        },
        '.text-shadow-sm': {
          textShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
        },
        '.text-shadow': {
          textShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
        },
        '.text-shadow-lg': {
          textShadow: '0 4px 8px rgba(0, 0, 0, 0.3)',
        },
        '.custom-scrollbar': {
          '&::-webkit-scrollbar': {
            width: '8px',
          },
          '&::-webkit-scrollbar-track': {
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '10px',
          },
          '&::-webkit-scrollbar-thumb': {
            background: 'rgba(255, 255, 255, 0.2)',
            borderRadius: '10px',
            '&:hover': {
              background: 'rgba(255, 255, 255, 0.3)',
            },
          },
        },
        '.voice-indicator': {
          position: 'relative',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: '-4px',
            left: '-4px',
            right: '-4px',
            bottom: '-4px',
            background: 'linear-gradient(45deg, #00ff87, #60efff)',
            borderRadius: 'inherit',
            zIndex: '-1',
            opacity: '0',
            transition: 'opacity 0.3s ease',
          },
          '&.speaking::before': {
            opacity: '1',
            animation: 'pulse-ring 2s cubic-bezier(0.455, 0.03, 0.515, 0.955) infinite',
          },
        },
      };
      
      addUtilities(newUtilities, ['responsive', 'hover']);
    },
  ],
}