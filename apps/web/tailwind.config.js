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
        /*
         * `ink` reste déclinable en opacité pour les fonds et les filets
         * (`bg-ink/5`), mais le texte secondaire a ses propres encres pleines,
         * au contraste mesuré : voir index.css.
         */
        ink: {
          DEFAULT: avecOpacite("--ink"),
          2: avecOpacite("--ink-2"),
          3: avecOpacite("--ink-3"),
        },
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
         * Une seule famille, Inter, pour les titres, le texte et les chiffres.
         * Elle est dessinée pour l'écran aux petites tailles, et ses chiffres
         * tabulaires alignent les colonnes sans recourir à une police à
         * chasse fixe. `mono` est gardé comme nom pour ne pas toucher aux
         * cent emplois qui désignent un chiffre, pas du code.
         */
        display: ["'Inter Variable'", "Inter", "system-ui", "sans-serif"],
        sans: ["'Inter Variable'", "Inter", "system-ui", "sans-serif"],
        mono: ["'Inter Variable'", "Inter", "system-ui", "sans-serif"],
        code: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      /*
       * Échelle relevée d'un cran : 13 px au lieu de 12 pour les mentions,
       * 14,5 au lieu de 14 pour le texte courant. Les deux tailles portent à
       * elles seules plus de quatre cents emplois ; les changer ici relève
       * toute l'interface sans réécrire un écran.
       */
      fontSize: {
        xs: ["0.8125rem", { lineHeight: "1.2rem" }],
        sm: ["0.90625rem", { lineHeight: "1.4rem" }],
      },
    },
  },
  plugins: [],
};
