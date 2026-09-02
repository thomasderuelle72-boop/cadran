/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#171F19",
        paper: "#F2F3EC",
        primary: {
          DEFAULT: "#1F5C4E",
          soft: "#DCE9E3",
        },
        accent: {
          DEFAULT: "#9C5F26",
          soft: "#F0DFC2",
        },
        success: { DEFAULT: "#2F7D4F", soft: "#DDEEE1" },
        warning: { DEFAULT: "#9C7A16", soft: "#F3ECD2" },
        critical: { DEFAULT: "#AE3B32", soft: "#F5DFDB" },
      },
      fontFamily: {
        display: ["'Source Serif 4'", "Georgia", "serif"],
        sans: ["'IBM Plex Sans'", "system-ui", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
    },
  },
  plugins: [],
};
