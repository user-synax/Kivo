/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
    "./lib/**/*.{js,jsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        base: "#090909",
        surface: "#141414",
        elevated: "#1c1c1c",
        accent: "#4ba9e1",
        muted: "#999999",
        border: "#262626",
        online: "#22c55e",
      },
    },
  },
  plugins: [],
};
