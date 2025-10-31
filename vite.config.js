import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // Use relative paths for Yandex Games compatibility
  server: {
    port: 3000,
    open: true
  },
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0, // Don't inline assets
    rollupOptions: {
      output: {
        manualChunks: undefined // Keep single bundle for simplicity
      }
    }
  }
});
