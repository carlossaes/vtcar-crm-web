/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: '#0f1117',
        bg2: '#1a1d27',
        bg3: '#22263a',
        border: '#2e3250',
        accent: '#e63946',
        accent2: '#ff6b6b',
        text: '#e8eaf6',
        text2: '#8b93b8',
      },
    },
  },
  plugins: [],
}
