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
        /*
         * `display` et `sans` pointent la même famille : un instrument ne
         * change pas de caractère entre son titre et son relevé. La
         * distinction se fait à la graisse et à la chasse, pas à la police.
         * Les deux noms restent séparés pour que la palette Cadran puisse
         * remettre un romain sur `display` sans toucher aux composants.
         */
        display: ["var(--police-titre)", "'Inter Tight'", "system-ui", "sans-serif"],
        sans: ["'Inter Tight'", "system-ui", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
    },
  },
  plugins: [],
};
