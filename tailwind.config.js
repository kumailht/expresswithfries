/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './templates/**/*.html',
    'node_modules/preline/dist/*.js'
  ],
  // enable dark mode via class strategy
  darkMode: 'class',
  theme: {
    extend: {},
  },
  plugins: [
    require('preline/plugin'),
    require('@tailwindcss/typography'),
  ],
}

