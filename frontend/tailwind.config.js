/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'bg-main': '#1E1E1E',
        'bg-card': '#2A2A2A',
        'text-primary': '#FFFFFF',
        'text-secondary': '#A0A0A0',
        'border-color': '#3A3A3A',
        'active-bg': '#FFFFFF',
        'active-text': '#121212'
      },
      fontFamily: {
        'inter': ['Inter', 'sans-serif'],
      },
      borderRadius: {
        'pill': '9999px',
        'card': '8px',
        'alphabet': '10px',
      }
    }
  },
  plugins: [],
}