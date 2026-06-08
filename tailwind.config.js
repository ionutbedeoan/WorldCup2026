/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cupGold: {
          50: '#fbf7e7',
          100: '#f5eab3',
          200: '#eed880',
          300: '#e6c34d',
          400: '#deac26',
          500: '#c6951b',
          600: '#9b7113',
          700: '#704f0d',
          800: '#442e06',
          900: '#180f01',
        },
        cupEmerald: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          950: '#022c22', // Darkest rich green
        }
      },
      fontFamily: {
        sans: ['Outfit', 'Inter', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
