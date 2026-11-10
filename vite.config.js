import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
      // Socket.IO (websocket) — realtime updates in dev
      '/socket.io': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        ws: true,
      },
      // Uploaded files served by the backend
      '/uploads': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    // Source maps only in development — production bundles ship without them
    // so the final assets are smaller and nothing is downloaded by default.
    sourcemap: false,
    // Raise the chunk-size warning threshold slightly (pdfmake is legitimately big).
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // Deterministic manual chunks so browsers can cache vendor code
        // independently of application code. Each group only re-downloads
        // when its own dependencies change.
        manualChunks: {
          // React core — changes least often; cache longest.
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Network / realtime layer.
          'vendor-io': ['socket.io-client', 'axios'],
          // Heavy doc-generation libs — only loaded when a user exports.
          'vendor-pdf': ['pdfmake'],
          'vendor-xlsx': ['xlsx'],
          // Lightweight state management.
          'vendor-zustand': ['zustand'],
        },
      },
    },
    // Minify with esbuild (the Vite default) but be explicit so it's clear.
    minify: 'esbuild',
    // Target modern browsers so esbuild can apply newer, smaller transforms.
    target: 'es2020',
  },
  // Vite already pre-bundles deps; list big ones explicitly so cold-start
  // HMR doesn't stall while they parse.
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'axios', 'socket.io-client', 'zustand'],
  },
});
