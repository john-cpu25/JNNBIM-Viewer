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
        jnn: {
          primary: {
            DEFAULT: '#0891b2',
            hover: '#0e7490',
            light: '#cffafe'
          },
          dark: {
            bg: '#0b0f19',
            surface: '#111827',
            elevated: '#1f2937',
            border: '#1f293d'
          },
          light: {
            bg: '#f1f5f9',
            surface: '#ffffff',
            elevated: '#f8fafc',
            border: '#cbd5e1'
          }
        }
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace']
      }
    },
  },
  plugins: [],
}
