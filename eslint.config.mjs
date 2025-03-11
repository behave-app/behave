import { fixupConfigRules, fixupPluginRules } from "@eslint/compat";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";
import cypress from "eslint-plugin-cypress";
import mochaPlugin from 'eslint-plugin-mocha';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

export default [...fixupConfigRules(compat.extends(
  "eslint:recommended",
  "plugin:@typescript-eslint/recommended",
  "plugin:import/recommended",
  "plugin:import/typescript",
)),
  mochaPlugin.configs.flat.recommended,
  {
    ignores: [
      "public/",
      "eslint.config.mjs",
      "determine_version_number.mjs",
      "markdown.mjs",
      "cypress.config.ts",
    ],
  }, {
    plugins: {
      "@typescript-eslint": fixupPluginRules(typescriptEslint),
    },

    languageOptions: {
      parser: tsParser,
      ecmaVersion: 5,
      sourceType: "script",

      parserOptions: {
        project: "./tsconfig.json",
      },
    },

    rules: {
      "no-warning-comments": "error",
      "@typescript-eslint/no-floating-promises": "error",

      "no-constant-condition": ["error", {
        checkLoops: false,
      }],

      "@typescript-eslint/no-misused-promises": ["error", {
        checksVoidReturn: false,
      }],

      "@typescript-eslint/no-for-in-array": "error",

      "import/no-cycle": ["error", {
        maxDepth: 20,
        allowUnsafeDynamicCyclicDependency: true,
      }],

      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      }],

      "@typescript-eslint/strict-boolean-expressions": ["warn", {
        allowNullableBoolean: true,
      }],
    },
  }, {
    files: ["cypress/**/*.ts"],
    plugins: {
      cypress,
    },
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 5,
      sourceType: "script",
      globals: {
        ...cypress.environments.globals.globals,
      },

      parserOptions: {
        project: "cypress/tsconfig.json",
      },
    },
    rules: {
      "cypress/no-assigning-return-values": "error",
      "cypress/no-unnecessary-waiting": "error",
      "cypress/assertion-before-screenshot": "warn",
      "cypress/no-force": "warn",
      "cypress/no-async-tests": "error",
      "cypress/no-async-before": "error",
      "cypress/no-pause": "error",
      "cypress/no-debug": "error",

    },
  }
];
