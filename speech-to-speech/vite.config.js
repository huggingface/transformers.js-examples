import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), react()],
  build: {
    target: "esnext",
  },
  worker: {
    format: "es",
  },
  resolve: {
    // Only bundle a single instance of Transformers.js
    // (shared by `@huggingface/transformers` and `kokoro-js`)
    dedupe: ["@huggingface/transformers"],
  },
});
