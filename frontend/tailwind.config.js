/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        echo: {
          bg: "#0a0e17",
          card: "#111827",
          border: "#1f2937",
          accent: "#22d3ee",
          danger: "#f43f5e",
          warn: "#fbbf24",
          ok: "#34d399",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
