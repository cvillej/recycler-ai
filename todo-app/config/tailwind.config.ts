import type { Config } from 'tailwindcss'

export default {
  content: [
    "./index.html",
    "./todo/**/*.{js,ts,jsx,tsx}",
    "./src/**/*.{js,ts,jsx,tsx}", // fallback
  ],
  theme: {
    extend: {},
  },
  plugins: [],
} satisfies Config
