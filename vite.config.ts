import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    strictPort: false,
    proxy: {
      '/api': {
        // Proxy API calls to the mobile backend (production/dev endpoint)
        target: 'https://micladevops.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api/, '/api/v2'),
      },
      '/socket.io': {
        // Socket.IO endpoint runs on the same host (different path)
        target: 'https://micladevops.com',
        ws: true,
        changeOrigin: true,
        secure: true,
      },
    },
  },
})
