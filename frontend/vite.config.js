import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const target = env.VITE_PROXY_TARGET || "http://localhost:5000";
  return {
    plugins: [react()],
    server: {
      port: 5173,
      // Browser calls /api/... on port 5173, Vite forwards them to the backend.
      proxy: { "/api": { target, changeOrigin: true } },
    },
  };
});
