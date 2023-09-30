// const terser = require("@rollup/plugin-terser");
// const typescript = require("@rollup/plugin-typescript");
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";
import nodeResolve from "@rollup/plugin-node-resolve";

export default {
  input: "src/background.ts",
  output: {
    sourcemap: false,
    format: "iife",
  },
  plugins: [nodeResolve(), typescript(), /* terser() */],
};
