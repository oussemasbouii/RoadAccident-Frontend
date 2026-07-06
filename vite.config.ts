import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    chunkSizeWarningLimit: 3000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          // MapLibre has no React deps — safe to split
          if (id.includes('maplibre-gl')) return 'vendor-map'
          // Everything else stays in one vendor chunk — avoids circular load-order crashes
          return 'vendor-libs'
        },
      },
    },
  },
  test: {
    globals: true,
    environment: "happy-dom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
  server: {
    port: 5273,
    strictPort: false,
    hmr: false,
    proxy: {
      "/api": {
        // Proxy API calls to the API server
        target: "https://api.micladevops.com",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api/, "/api/v2"),
      },
      "/socket.io": {
        // Socket.IO endpoint runs on the same host (different path)
        target: "https://micladevops.com",
        ws: true,
        changeOrigin: true,
        secure: true,
      },
    },
  },
});
