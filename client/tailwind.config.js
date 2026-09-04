/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: "#0B0F17",
        card: "#111827",
        border: "#1F2937",
        emerald: {
          400: "#10B981",
          500: "#059669",
        },
        amber: {
          400: "#F59E0B",
          500: "#D97706",
        },
        indigo: {
          400: "#818CF8",
          500: "#6366F1",
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        heading: ['Outfit', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      }
    },
  },
  plugins: [],
}
