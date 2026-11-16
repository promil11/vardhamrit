/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        chai: {
          50: '#F3FAF6',
          100: '#E2F4EB',
          200: '#C2E8D5',
          300: '#94D4B4',
          400: '#5FBA8E',
          500: '#1B6A48',
          600: '#145338',
          700: '#0E3D29',
          800: '#08281B',
          900: '#04160E',
          950: '#020C07',
        },
        kadak: {
          50: '#FFFDF5',
          100: '#FEF9E7',
          200: '#FDF0C3',
          300: '#FCE395',
          400: '#F9D15D',
          500: '#F59E0B',
          600: '#D97706',
          700: '#B45309',
          800: '#92400E',
          900: '#78350F',
        },
        gold: {
          50: '#FAF8F0',
          100: '#F4EFCF',
          200: '#E9DD9C',
          300: '#DECB69',
          400: '#D3B936',
          500: '#C5A81E',
          600: '#A18715',
          700: '#7D670F',
        },
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        'card-subtle': '0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 1px 2px -1px rgba(0, 0, 0, 0.04)',
        'card-elevated': '0 4px 20px -2px rgba(6, 35, 22, 0.08), 0 2px 6px -1px rgba(6, 35, 22, 0.04)',
        'card-hover': '0 10px 25px -4px rgba(6, 35, 22, 0.12), 0 4px 10px -2px rgba(6, 35, 22, 0.06)',
      },
    },
  },
  plugins: [],
};
