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
        ...globals.browser,
        ...globals.es2021,
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

      // General quality rules
      "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
      "no-console": "warn",
      "no-debugger": "error",
    },
  },

  // Ignore build output and deps
  {
    ignores: [
      "build/**",
      "dist/**",
      "node_modules/**",
      "coverage/**",
      "*.config.js",
      "craco.config.js",
    ],
  },
];
