// eslint.config.mjs — Garde-fou statique de Cadran (API + web).
//
// Le build TypeScript attrape les erreurs de type, pas le code mort : une
// fonction d'API sans appelant, une variable oubliée après un refactor ou une
// dépendance de hook manquante passent la compilation sans un mot. Ce sont
// exactement les règles retenues ici ; le formatage n'est volontairement pas
// contraint.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

const unusedVars = [
  "error",
  { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true },
];

export default tseslint.config(
  {
    ignores: ["**/dist/**", "**/node_modules/**", "apps/api/prisma/migrations/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ["apps/api/**/*.ts"],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": unusedVars,
      // Les payloads Prisma en Json sont typés `unknown` : les relire impose
      // une assertion. La règle ne ferait que pousser à des types factices.
      "@typescript-eslint/no-explicit-any": "off",
    },
  },

  {
    files: ["apps/api/**/*.spec.ts"],
    languageOptions: {
      globals: { ...globals.node, ...globals.jest },
    },
  },

  {
    files: ["apps/web/**/*.{ts,tsx}"],
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: "18.3" } },
    plugins: { react, "react-hooks": reactHooks },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": unusedVars,

      // Transformation JSX moderne : pas besoin d'importer React partout, et
      // les types remplacent avantageusement les propTypes.
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",

      // Une dépendance de hook manquante produit un écran qui affiche des
      // données périmées, sans jamais lever d'erreur.
      "react-hooks/exhaustive-deps": "warn",

      // Le texte de l'interface est en français : apostrophes et espaces
      // insécables sont voulus, pas des caractères parasites.
      "react/no-unescaped-entities": "off",

      // Vise tout setState dans un effet. Le motif visé ici (réinitialiser la
      // période sélectionnée quand l'entité change) est la façon standard de
      // synchroniser un état dérivé d'une requête. Le désactiver est un choix
      // assumé, pas un oubli.
      "react-hooks/set-state-in-effect": "off",
    },
  }
);
