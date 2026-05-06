import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: process.env.GITHUB_PAGES === "true" ? "/proof-of-risk/" : "/",
  plugins: [react()],
  test: {
    exclude: ["node_modules/**", "dist/**", "tests/e2e/**"],
    environment: "node",
    globals: true
  }
});
