import js from "@eslint/js"
import tseslint from "typescript-eslint"
import reactPlugin from "eslint-plugin-react"
import reactHooksPlugin from "eslint-plugin-react-hooks"

export default tseslint.config(
  // Global ignores
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "Migration/**",
      "*.config.js",
      "*.config.mjs",
      "*.config.ts",
    ],
  },

  // Base JS rules
  js.configs.recommended,

  // TypeScript rules
  ...tseslint.configs.recommended,

  // React and custom rules
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      react: reactPlugin,
      "react-hooks": reactHooksPlugin,
    },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    rules: {
      // Unused imports/variables detection
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],

      // Console warnings
      "no-console": ["warn", { allow: ["warn", "error"] }],

      // Helpful rules
      "prefer-const": "warn",
      "no-var": "error",

      // Disable overly strict rules
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-non-null-assertion": "off",
      "react/react-in-jsx-scope": "off",
    },
  }
)
