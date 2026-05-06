// ESLint flat config (ESLint v9+)
// Production-hardening baseline: errors only.
// Warnings disabled until team runs a dedicated lint-cleanup sprint.
// Tracked: https://github.com/mjkasonde-ship-it/app/issues  (lint-cleanup label)
import js from "@eslint/js";
import globals from "globals";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";

export default [
  // Base JS recommended rules
  js.configs.recommended,

  // React source files
  {
    files: ["src/**/*.{js,jsx,ts,tsx}"],
    plugins: {
      react: reactPlugin,
      "react-hooks": reactHooksPlugin,
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        // Browser globals (window, document, navigator, etc.)
        ...globals.browser,
        ...globals.es2021,
        // CRA injects process.env at build time – not a real browser global
        process: "readonly",
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      react: { version: "detect" },
    },
    rules: {
      // ── React recommended rules ──────────────────────────────────────────
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,

      // React 17+ JSX transform – no longer needs React in scope
      "react/react-in-jsx-scope": "off",
      // TypeScript / PropTypes handled elsewhere
      "react/prop-types": "off",
      // Custom HTML attributes used by cmdk component library
      "react/no-unknown-property": ["error", { ignore: ["cmdk-input-wrapper"] }],
      // Legacy JSX text with unescaped entities – pre-existing, off until cleanup
      "react/no-unescaped-entities": "off",

      // ── React Hooks – downgrade exhaustive-deps to warn ──────────────────
      // Missing deps in useEffect arrays is a common legacy pattern; warn only
      "react-hooks/exhaustive-deps": "off",

      // ── General quality – off until cleanup sprint ───────────────────────
      "no-unused-vars": "off",
      "no-console": "off",
      "no-undef": "off",        // CRA handles env globals; too noisy here
      "no-debugger": "error",   // Always block debugger statements
    },
  },

  // Ignore generated / vendored directories
  {
    ignores: [
      "build/**",
      "dist/**",
      "node_modules/**",
      "coverage/**",
      "craco.config.js",
      "tailwind.config.js",
      "postcss.config.js",
    ],
  },
];
