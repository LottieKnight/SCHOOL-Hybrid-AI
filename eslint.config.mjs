import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import js from "@eslint/js";
import tseslint from "typescript-eslint";

const apiFiles = ["apps/api/src/**/*.ts"];

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/dist/**",
      "**/build/**",
      "**/coverage/**",
      "**/.expo/**",
      "**/android/**",
      "**/ios/**",
      "**/out/**",
      "**/next-env.d.ts",
    ],
  },
  ...nextCoreWebVitals,
  {
    rules: {
      "@next/next/no-html-link-for-pages": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
      "react/no-unescaped-entities": "off",
      "import/no-anonymous-default-export": "off",
    },
  },
  { ...js.configs.recommended, files: apiFiles },
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: apiFiles,
  })),
  {
    files: apiFiles,
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "off",
      "no-useless-escape": "warn",
    },
  },
];
