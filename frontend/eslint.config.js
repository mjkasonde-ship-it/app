// ESLint flat config (ESLint v9+)
// Replaces legacy .eslintrc.* format
import js from "@eslint/js";
import globals from "globals";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";

export default [
  // Base JS recommended rules
  js.configs.recommended,

  // React files
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
        // Browser globals (window, document, etc.)
        ...globals.browser,
        ...globals.es2021,
        // CRA injects process.env at build time
        process: "readonly",
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    rules: {
      // React rules
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      "react/react-in-jsx-scope": "off",   // Not needed with React 17+ new JSX transform
      "react/prop-types": "off",            // TypeScript handles this
      // Allow custom HTML attributes (e.g. cmdk data attributes)
      "react/no-unknown-property": ["error", { ignore: ["cmdk-input-wrapper"] }],

      // General quality rules
      "no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],
      "no-console": "warn",
      "no-debugger": "error",
      "no-undef": "warn",  // Warn instead of error for CRA compatibility
    },
  },

  // Ignore build output and deps
  {
    ignores: [
      "build/**",
      "dist/**",
      "node_modules/**",
      "coverage/**",
      "craco.config.js",
    ],
  },
];
