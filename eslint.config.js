// no-undef is the rule that matters here, as in cap2UI5/cap2UI5: an undefined
// identifier in a sample is a runtime error that shows only once somebody
// presses the right button. Nothing else is switched on - the tests are the
// real gate.
const host = {
  process: "readonly",
  console: "readonly",
  Buffer: "readonly",
  fetch: "readonly",
  URL: "readonly",
};

export default [
  {
    ignores: ["node_modules/**"],
  },
  {
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: host,
    },
    rules: {
      "no-undef": "error",
      "no-unused-vars": ["error", { args: "none" }],
    },
  },
  {
    files: ["**/*.cjs"],
    languageOptions: {
      sourceType: "commonjs",
      globals: { ...host, module: "writable", require: "readonly" },
    },
  },
];
