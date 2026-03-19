/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: "#2C3E6B",
        teal: "#1D9E75",
        coral: "#D85A30",
        amber: "#BA7517",
        jgreen: "#639922",
        jblue: "#378ADD",
        jred: "#E24B4A",
        jgray: "#888780",
        light: "#f8f7f4",
        jborder: "#e8e8e4",
      },
      fontFamily: {
        display: ['"DM Sans"', 'system-ui', 'sans-serif'],
        body: ['"DM Sans"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
