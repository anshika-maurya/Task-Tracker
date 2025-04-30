/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#FF8C00',     // Main orange
        secondary: '#FF6B00',   // Darker orange for hover
        accent: '#FFB347',      // Lighter orange
        light: '#FFF8F0',       // Very light orange/cream
        dark: '#222222',        // Dark gray/black
      }
    },
  },
  plugins: [],
}