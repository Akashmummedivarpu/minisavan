/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#000000',
        primary: '#FFFFFF',
        secondary: 'rgba(255, 255, 255, 0.55)',
        glass: 'rgba(20, 20, 20, 0.45)',
        glassBorder: 'rgba(255, 255, 255, 0.08)',
        accent: '#22c55e', // Live dot color
      },
      fontFamily: {
        sans: ['Satoshi', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
