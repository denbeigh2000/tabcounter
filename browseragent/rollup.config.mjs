// const terser = require("@rollup/plugin-terser");
// const typescript = require("@rollup/plugin-typescript");
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";

export default {
  input: "src/background.ts",
  output: {
    sourcemap: false,
    file: "build/background.js",
    format: "iife",
  },
  plugins: [typescript(), terser()],
};
