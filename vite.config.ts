import { createRequire } from "node:module";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const require = createRequire(import.meta.url);
const monacoEditorPlugin = (
  require("vite-plugin-monaco-editor") as { default: (opts: { languageWorkers: string[] }) => import("vite").Plugin }
).default;

export default defineConfig({
  plugins: [
    react(),
    monacoEditorPlugin({
      languageWorkers: ["editorWorkerService", "json"],
    }),
  ],
});
