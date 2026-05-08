// Flat config (ESLint 9+). Minimal TS-aware setup — typecheck via tsc is the
// real type safety; ESLint here just catches the obvious style/correctness
// issues that the compiler doesn't.
import tseslint from "typescript-eslint";

export default tseslint.config(
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    ignores: ["dist/**", "node_modules/**"],
  },
);
