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
        // Anthropic/Claude Brand Colors
        anthropic: {
          orange: {
            DEFAULT: '#b05730',
            hover: '#9e4a28',
            light: '#d97706',
          },
          purple: {
            DEFAULT: '#6c5dac',
            light: '#8b7bb8',
          },
        },
        
        // Background System
        background: {
          primary: '#f0eee5',
          secondary: '#faf9f7',
          tertiary: '#f5f3ed',
          elevated: '#ffffff',
          panel: '#ffffff',
          overlay: 'rgba(255, 255, 255, 0.95)',
          input: '#fefdfb',
          code: '#f8f7f4',
        },
        
        // Text Hierarchy
        text: {
          primary: '#1a1a1a',
          secondary: '#4a4a4a',
          tertiary: '#6b6b6b',
          muted: '#8a8a8a',
          inverse: '#ffffff',
          accent: '#b05730',
        },
        
        // Border System
        border: {
          primary: '#e5e2d9',
          secondary: '#d1ccc1',
          muted: '#f0ede4',
          focus: '#b05730',
          error: '#dc2626',
          success: '#059669',
        },
        
        // Interactive States
        interactive: {
          hover: 'rgba(176, 87, 48, 0.08)',
          active: 'rgba(176, 87, 48, 0.12)',
          selected: 'rgba(176, 87, 48, 0.1)',
          disabled: '#f5f3ed',
          focus: 'rgba(176, 87, 48, 0.15)',
        },
        
        // Semantic Colors
        success: {
          DEFAULT: '#059669',
          bg: 'rgba(5, 150, 105, 0.1)',
          50: '#ecfdf5',
          100: '#d1fae5',
          500: '#059669',
          600: '#047857',
          900: '#064e3b',
        },
        
        warning: {
          DEFAULT: '#d97706',
          bg: 'rgba(217, 119, 6, 0.1)',
          50: '#fffbeb',
          100: '#fef3c7',
          500: '#d97706',
          600: '#c2640a',
          900: '#78350f',
        },
        
        error: {
          DEFAULT: '#dc2626',
          bg: 'rgba(220, 38, 38, 0.1)',
          50: '#fef2f2',
          100: '#fee2e2',
          500: '#dc2626',
          600: '#b91c1c',
          900: '#7f1d1d',
        },
        
        info: {
          DEFAULT: '#2563eb',
          bg: 'rgba(37, 99, 235, 0.1)',
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#2563eb',
          600: '#1d4ed8',
          900: '#1e3a8a',
        },
      },
      
      fontFamily: {
        // Anthropic-inspired typography
        sans: [
          'Inter Variable',
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
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
          'Consolas',
          'Liberation Mono',
          'Menlo',
          'monospace',
        ],
        display: [
          'Inter Variable',
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
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
        // Enhanced spacing scale
        '18': '4.5rem',
        '72': '18rem',
        '84': '21rem',
        '96': '24rem',
        '108': '27rem',
        '120': '30rem',
      },
      
      borderRadius: {
        // Anthropic-inspired radius system
        'xs': '0.25rem',
        'sm': '0.375rem',
        'md': '0.5rem',
        'lg': '0.75rem',
        'xl': '1rem',
        '2xl': '1.5rem',
        '3xl': '3rem',
      },
      
      boxShadow: {
        // Subtle, academic shadows
        'xs': '0 1px 2px 0 rgba(0, 0, 0, 0.03)',
        'sm': '0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 1px 2px 0 rgba(0, 0, 0, 0.02)',
        'md': '0 4px 6px -1px rgba(0, 0, 0, 0.06), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
        'lg': '0 10px 15px -3px rgba(0, 0, 0, 0.06), 0 4px 6px -2px rgba(0, 0, 0, 0.03)',
        'xl': '0 20px 25px -5px rgba(0, 0, 0, 0.06), 0 10px 10px -5px rgba(0, 0, 0, 0.02)',
        'focus': '0 0 0 3px rgba(176, 87, 48, 0.1)',
        
        // Dark mode shadows
        'dark-xs': '0 1px 2px 0 rgba(0, 0, 0, 0.3)',
        'dark-sm': '0 1px 3px 0 rgba(0, 0, 0, 0.4), 0 1px 2px 0 rgba(0, 0, 0, 0.3)',
        'dark-md': '0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -1px rgba(0, 0, 0, 0.3)',
        'dark-lg': '0 10px 15px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -2px rgba(0, 0, 0, 0.3)',
        'dark-xl': '0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 10px 10px -5px rgba(0, 0, 0, 0.3)',
        'dark-focus': '0 0 0 3px rgba(230, 126, 34, 0.15)',
      },
      
      animation: {
        // Anthropic-style subtle animations
        'fade-in': 'fadeIn 300ms cubic-bezier(0, 0, 0.2, 1)',
        'fade-out': 'fadeOut 200ms cubic-bezier(0.4, 0, 1, 1)',
        'slide-up': 'slideUp 300ms cubic-bezier(0, 0, 0.2, 1)',
        'slide-down': 'slideDown 300ms cubic-bezier(0, 0, 0.2, 1)',
        'slide-left': 'slideLeft 300ms cubic-bezier(0, 0, 0.2, 1)',
        'slide-right': 'slideRight 300ms cubic-bezier(0, 0, 0.2, 1)',
        'scale-in': 'scaleIn 200ms cubic-bezier(0, 0, 0.2, 1)',
        'scale-out': 'scaleOut 150ms cubic-bezier(0.4, 0, 1, 1)',
        'pulse-orange': 'pulseOrange 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-gentle': 'bounceGentle 1s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'spin-slow': 'spin 2s linear infinite',
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
        pulseOrange: {
          '0%, 70%, 100%': { transform: 'scale(1)', opacity: '1' },
          '35%': { transform: 'scale(0.95)', opacity: '0.8' },
        },
        bounceGentle: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-4px)' },
        },
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
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
      
      zIndex: {
        'base': '0',
        'docked': '10',
        'dropdown': '1000',
        'sticky': '1100',
        'banner': '1200',
        'overlay': '1300',
        'modal': '1400',
        'popover': '1500',
        'tooltip': '1600',
        'toast': '1700',
      },
      
      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        'bounce': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
      },
      
      transitionDuration: {
        '0': '0ms',
        '75': '75ms',
        '400': '400ms',
        '600': '600ms',
        '800': '800ms',
        '1200': '1200ms',
      },
    },
  },
  plugins: [
    // Custom utilities for Anthropic design system
    function({ addUtilities, addComponents, theme }) {
      // Typography utilities
      addUtilities({
        '.text-balance': {
          'text-wrap': 'balance',
        },
        '.text-pretty': {
          'text-wrap': 'pretty',
        },
        '.font-feature-default': {
          'font-feature-settings': '"liga", "kern"',
        },
        '.font-feature-tabular': {
          'font-feature-settings': '"liga", "kern", "tnum"',
        },
      });

      // Anthropic-specific component utilities
      addComponents({
        '.btn-primary': {
          backgroundColor: theme('colors.anthropic.orange.DEFAULT'),
          color: theme('colors.text.inverse'),
          borderRadius: theme('borderRadius.md'),
          padding: `${theme('spacing.2')} ${theme('spacing.4')}`,
          fontWeight: theme('fontWeight.semibold'),
          fontSize: theme('fontSize.sm'),
          transition: 'all 200ms cubic-bezier(0, 0, 0.2, 1)',
          border: 'none',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: theme('spacing.2'),
          minHeight: '40px',
          '&:hover': {
            backgroundColor: theme('colors.anthropic.orange.hover'),
            transform: 'translateY(-1px)',
            boxShadow: theme('boxShadow.md'),
          },
          '&:active': {
            transform: 'translateY(0)',
            boxShadow: theme('boxShadow.sm'),
          },
          '&:disabled': {
            backgroundColor: theme('colors.interactive.disabled'),
            color: theme('colors.text.muted'),
            cursor: 'not-allowed',
            transform: 'none',
            boxShadow: 'none',
          },
        },
        
        '.btn-secondary': {
          backgroundColor: theme('colors.background.elevated'),
          color: theme('colors.text.primary'),
          border: `1px solid ${theme('colors.border.primary')}`,
          borderRadius: theme('borderRadius.md'),
          padding: `${theme('spacing.2')} ${theme('spacing.4')}`,
          fontWeight: theme('fontWeight.semibold'),
          fontSize: theme('fontSize.sm'),
          transition: 'all 200ms cubic-bezier(0, 0, 0.2, 1)',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: theme('spacing.2'),
          minHeight: '40px',
          '&:hover': {
            backgroundColor: theme('colors.interactive.hover'),
            borderColor: theme('colors.border.secondary'),
            transform: 'translateY(-1px)',
            boxShadow: theme('boxShadow.md'),
          },
          '&:active': {
            transform: 'translateY(0)',
            boxShadow: theme('boxShadow.sm'),
          },
        },
        
        '.btn-ghost': {
          backgroundColor: 'transparent',
          color: theme('colors.text.secondary'),
          border: '1px solid transparent',
          borderRadius: theme('borderRadius.md'),
          padding: `${theme('spacing.2')} ${theme('spacing.4')}`,
          fontWeight: theme('fontWeight.semibold'),
          fontSize: theme('fontSize.sm'),
          transition: 'all 200ms cubic-bezier(0, 0, 0.2, 1)',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: theme('spacing.2'),
          minHeight: '40px',
          '&:hover': {
            backgroundColor: theme('colors.interactive.hover'),
            color: theme('colors.text.primary'),
          },
        },
        
        '.input-field': {
          width: '100%',
          backgroundColor: theme('colors.background.input'),
          border: `1px solid ${theme('colors.border.primary')}`,
          color: theme('colors.text.primary'),
          borderRadius: theme('borderRadius.lg'),
          padding: `${theme('spacing.3')} ${theme('spacing.4')}`,
          outline: 'none',
          transition: 'all 200ms cubic-bezier(0, 0, 0.2, 1)',
          fontFamily: theme('fontFamily.sans'),
          fontSize: theme('fontSize.sm'),
          lineHeight: theme('lineHeight.6'),
          '&:focus': {
            borderColor: theme('colors.border.focus'),
            boxShadow: theme('boxShadow.focus'),
            backgroundColor: theme('colors.background.elevated'),
          },
          '&::placeholder': {
            color: theme('colors.text.muted'),
          },
        },
        
        '.card': {
          backgroundColor: theme('colors.background.elevated'),
          border: `1px solid ${theme('colors.border.muted')}`,
          borderRadius: theme('borderRadius.lg'),
          padding: theme('spacing.5'),
          boxShadow: theme('boxShadow.sm'),
          transition: 'all 200ms cubic-bezier(0, 0, 0.2, 1)',
          '&:hover': {
            boxShadow: theme('boxShadow.md'),
            transform: 'translateY(-1px)',
          },
        },
        
        '.badge': {
          display: 'inline-flex',
          alignItems: 'center',
          padding: `${theme('spacing.1')} ${theme('spacing.2')}`,
          borderRadius: theme('borderRadius.sm'),
          fontSize: theme('fontSize.xs'),
          fontWeight: theme('fontWeight.semibold'),
          backgroundColor: theme('colors.background.tertiary'),
          color: theme('colors.text.secondary'),
          border: `1px solid ${theme('colors.border.muted')}`,
        },
        
        '.message-bubble-user': {
          backgroundColor: theme('colors.anthropic.orange.DEFAULT'),
          color: theme('colors.text.inverse'),
          padding: `${theme('spacing.3')} ${theme('spacing.4')}`,
          borderRadius: `${theme('borderRadius.lg')} ${theme('borderRadius.lg')} ${theme('borderRadius.sm')} ${theme('borderRadius.lg')}`,
          maxWidth: '70%',
          fontWeight: theme('fontWeight.medium'),
          boxShadow: theme('boxShadow.sm'),
        },
        
        '.message-bubble-assistant': {
          backgroundColor: theme('colors.background.elevated'),
          color: theme('colors.text.primary'),
          padding: `${theme('spacing.4')} ${theme('spacing.5')}`,
          borderRadius: `${theme('borderRadius.lg')} ${theme('borderRadius.lg')} ${theme('borderRadius.lg')} ${theme('borderRadius.sm')}`,
          maxWidth: '85%',
          border: `1px solid ${theme('colors.border.muted')}`,
          boxShadow: theme('boxShadow.sm'),
          lineHeight: theme('lineHeight.7'),
        },
        
        '.code-block': {
          backgroundColor: theme('colors.background.code'),
          border: `1px solid ${theme('colors.border.muted')}`,
          borderRadius: theme('borderRadius.md'),
          padding: theme('spacing.4'),
          fontFamily: theme('fontFamily.mono'),
          fontSize: '13px',
          lineHeight: theme('lineHeight.7'),
          overflowX: 'auto',
          margin: `${theme('spacing.4')} 0`,
        },
        
        '.inline-code': {
          backgroundColor: theme('colors.background.code'),
          color: theme('colors.text.primary'),
          padding: `2px ${theme('spacing.1')}`,
          borderRadius: theme('borderRadius.xs'),
          fontFamily: theme('fontFamily.mono'),
          fontSize: '0.9em',
          border: `1px solid ${theme('colors.border.muted')}`,
        },
      });

      // Scrollbar utilities
      addUtilities({
        '.scrollbar-thin': {
          'scrollbar-width': 'thin',
          'scrollbar-color': `${theme('colors.border.secondary')} transparent`,
        },
        '.scrollbar-none': {
          'scrollbar-width': 'none',
          '-ms-overflow-style': 'none',
          '&::-webkit-scrollbar': {
            display: 'none',
          },
        },
        '.scrollbar-custom': {
          '&::-webkit-scrollbar': {
            width: '6px',
          },
          '&::-webkit-scrollbar-track': {
            background: 'transparent',
          },
          '&::-webkit-scrollbar-thumb': {
            background: theme('colors.border.secondary'),
            borderRadius: theme('borderRadius.sm'),
          },
          '&::-webkit-scrollbar-thumb:hover': {
            background: theme('colors.border.primary'),
          },
        },
      });

      // Selection utilities
      addUtilities({
        '.select-none': {
          '-webkit-user-select': 'none',
          '-moz-user-select': 'none',
          '-ms-user-select': 'none',
          'user-select': 'none',
        },
        '.select-text': {
          '-webkit-user-select': 'text !important',
          '-moz-user-select': 'text !important',
          '-ms-user-select': 'text !important',
          'user-select': 'text !important',
        },
        '.select-all': {
          '-webkit-user-select': 'all',
          '-moz-user-select': 'all',
          '-ms-user-select': 'all',
          'user-select': 'all',
        },
      });
    },
  ],
}