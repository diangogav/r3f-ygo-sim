/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      screens: {
        horizontal: { raw: "(min-aspect-ratio:16/9)" },
        vertical: { raw: "(max-aspect-ratio:16/9)" },
      },
    },
  },
  plugins: [
    require("@tailwindcss/container-queries"),
    require("@xpd/tailwind-3dtransforms"),
  ],
};
