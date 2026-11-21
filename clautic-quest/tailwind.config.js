/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#E5213B', soft: '#FF5A6E', dark: '#B5132A' },
        cian: { DEFAULT: '#22D3EE', soft: '#67E8F9', dark: '#0891B2' },
        violet: { DEFAULT: '#8B5CF6', soft: '#A78BFA', dark: '#6D28D9' },
        mint: { DEFAULT: '#34D399' },
        night: { 950: '#080C20', 900: '#0E1430', 800: '#151C40', 700: '#1B2350', 600: '#26306A', 500: '#36428A' },
        ice: { DEFAULT: '#E8F1FF' },
      },
      fontFamily: {
        display: ['"Chakra Petch"', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(34,211,238,.35), 0 0 24px rgba(34,211,238,.25)',
        'glow-red': '0 0 0 1px rgba(229,33,59,.45), 0 0 24px rgba(229,33,59,.3)',
        'glow-violet': '0 0 0 1px rgba(139,92,246,.45), 0 0 24px rgba(139,92,246,.3)',
      },
      keyframes: {
        floatUp: { '0%': { opacity: 0, transform: 'translateY(6px) scale(.8)' }, '20%': { opacity: 1, transform: 'translateY(-6px) scale(1.1)' }, '100%': { opacity: 0, transform: 'translateY(-42px) scale(1)' } },
        pop: { '0%': { transform: 'scale(.6)', opacity: 0 }, '60%': { transform: 'scale(1.08)', opacity: 1 }, '100%': { transform: 'scale(1)' } },
        bob: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-4px)' } },
        shine: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
      },
      animation: {
        floatUp: 'floatUp 1.1s ease-out forwards',
        pop: 'pop .35s ease-out',
        bob: 'bob 3s ease-in-out infinite',
        shine: 'shine 3s linear infinite',
      },
    },
  },
  plugins: [],
};
