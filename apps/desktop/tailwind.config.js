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
        // Discord color palette
        discord: {
          darker: '#202225',
          dark: '#2f3136',
          'lighter-dark': '#36393f',
          light: '#40444b',
          blurple: '#5865f2',
          green: '#3ba55d',
          yellow: '#fee75c',
          fuchsia: '#eb459e',
          red: '#ed4245',
        },
        // Semantic colors
        background: {
          primary: '#36393f',
          secondary: '#2f3136',
          'secondary-alt': '#292b2f',
          tertiary: '#202225',
          accent: '#4f545c',
          floating: '#18191c',
        },
        text: {
          normal: '#dcddde',
          muted: '#72767d',
          link: '#00b0f4',
        },
        interactive: {
          normal: '#b9bbbe',
          hover: '#dcddde',
          active: '#fff',
          muted: '#4f545c',
        },
      },
      fontFamily: {
        sans: ['Whitney', 'Helvetica Neue', 'Helvetica', 'Arial', 'sans-serif'],
        mono: ['Consolas', 'Andale Mono WT', 'Andale Mono', 'Lucida Console', 'Monaco', 'Courier New', 'Courier', 'monospace'],
      },
      spacing: {
        '18': '4.5rem',
        '72': '18rem',
        '84': '21rem',
        '96': '24rem',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'discord-pulse': 'discord-pulse 1.5s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'discord-pulse': {
          '0%': { opacity: '1' },
          '50%': { opacity: '0.4' },
          '100%': { opacity: '1' },
        },
      },
      borderRadius: {
        'lg': '0.5rem',
        'xl': '0.75rem',
      },
    },
  },
  plugins: [],
}
