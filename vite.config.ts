import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { defineConfig } from "vite";
import mix from "vite-plugin-mix";

// https://vitejs.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  plugins: [
    react(),
    mix({
      handler: "./src/handler.ts",
    }),
  ],
});
