/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        arena: {
          bg: '#0a0e1a',
          surface: '#141a2a',
          border: '#1f2937',
          accent: '#e11d48',
          accentHover: '#be123c',
          text: '#f1f5f9',
          subtext: '#94a3b8',
        },
      },
    },
  },
  plugins: [],
};
