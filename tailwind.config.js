/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'ally-teal': '#00A8A8',
        'ally-teal-dark': '#008B8B',
        'ally-navy': '#1a365d',
      }
    },
  },
  plugins: [],
}
