/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'aqua': {
          50: '#f0fdff',
          100: '#ccfaff',
          200: '#99f5ff',
          300: '#66efff',
          400: '#33e8ff',
          500: '#00e0ff',
          600: '#00b3cc',
          700: '#008699',
          800: '#005a66',
          900: '#002d33',
        }
      }
    },
  },
  plugins: [],
}
