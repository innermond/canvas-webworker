import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  root: resolve(__dirname, "src"),
  resolve: {
    conditions: ["development", "browser"],
    alias: {
      "@": resolve(__dirname, "./src"),
      "@icon": resolve(__dirname, "./src/asset/icon"),
      "@img": resolve(__dirname, "./src/asset/img"),
    },
  },
  server: {
    port: 4200,
  },
  build: {
    target: "esnext",
    polyfillDynamicImport: false,
    outDir: resolve(__dirname, "dist"),
    rollupOptions: {
      input: resolve(__dirname, "src", "index.html"),
    },
  },
});
