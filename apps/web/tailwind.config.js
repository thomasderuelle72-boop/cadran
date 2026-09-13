/**
 * Les couleurs pointent vers des variables CSS définies dans src/index.css,
 * et non vers des valeurs figées : c'est ce qui permet au thème sombre de
 * n'exister qu'à un seul endroit. La syntaxe `<alpha-value>` conserve les
 * opacités de Tailwind (`text-ink/50`).
 */
const avecOpacite = (variable) => `rgb(var(${variable}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: avecOpacite("--paper"),
        surface: {
          DEFAULT: avecOpacite("--surface"),
          2: avecOpacite("--surface-2"),
        },
        ink: avecOpacite("--ink"),
        rule: avecOpacite("--rule"),
        primary: {
          DEFAULT: avecOpacite("--primary"),
          soft: avecOpacite("--primary-soft"),
        },
        accent: {
          DEFAULT: avecOpacite("--accent"),
          soft: avecOpacite("--accent-soft"),
        },
        success: {
          DEFAULT: avecOpacite("--success"),
          soft: avecOpacite("--success-soft"),
        },
        warning: {
          DEFAULT: avecOpacite("--warning"),
          soft: avecOpacite("--warning-soft"),
        },
        critical: {
          DEFAULT: avecOpacite("--critical"),
          soft: avecOpacite("--critical-soft"),
        },
        serie: {
          1: avecOpacite("--serie-1"),
          2: avecOpacite("--serie-2"),
        },
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
