import globals from "globals";
import pluginJs from "@eslint/js";

const appFiles = [
  "script.js",
  "content/**/*.js",
  "modules/**/*.js",
  "stores/**/*.js",
  "eslint.config.mjs"
];

const nodeFiles = ["scripts/**/*.mjs", "tests/**/*.js", "preview/**/*.mjs", "checks/**/*.mjs", "worker/**/*.mjs"];

const browserGlobals = {
  ...globals.browser,
  Alpine: "readonly",
  L: "readonly",
  d3: "readonly",
  tgaCodec: "readonly"
};

/** @type {import("eslint").Linter.Config[]} */
export default [
  {
    ignores: [
      "dist/**",
      "libs/**",
      "tmp/**",
      "data/**",
      "icons/**",
      "node_modules/**",
      "**/*.min.js"
    ]
  },
  {
    files: appFiles,
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: browserGlobals
    }
  },
  {
    files: nodeFiles,
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.node
    }
  },
  pluginJs.configs.recommended,
  {
    files: appFiles,
    rules: {
      "no-case-declarations": "warn",
      "no-console": "off",
      "no-undef": "warn",
      "no-unexpected-multiline": "warn",
      "no-unused-expressions": "warn",
      "no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_"
        }
      ]
    }
  },
  {
    files: ["*.config.mjs", "eslint.config.mjs", ...nodeFiles],
    languageOptions: {
      globals: globals.node
    }
  }
];
