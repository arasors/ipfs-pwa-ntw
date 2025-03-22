import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

import manifest from './manifest.json';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      // Polyfill yapılandırmaları 
      include: [
        'crypto',
        'stream',
        'http',
        'https',
        'zlib',
        'url',
        'buffer',
        'assert',
        'os',
        'path',
        'process',
      ],
      globals: {
        Buffer: true,
        process: true,
      },
    }),
    VitePWA({
      manifest,
      includeAssets: ['favicon.svg', 'favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
      // switch to "true" to enable sw on development
      devOptions: { enabled: false },
      registerType: 'autoUpdate',
      workbox: { globPatterns: ['**/*.{js,css,html}', '**/*.{svg,png,jpg,gif}'] },
    }),
  ],
  resolve: {
    alias: { 
      '@': path.resolve(__dirname, './src'),
    }
  },
  optimizeDeps: {
    esbuildOptions: {
      // Node.js global to browser globalThis
      define: {
        global: 'globalThis',
      },
    },
  },
  build: {
    rollupOptions: {
      // Uyarıları yoksay
      onwarn(warning, warn) {
        if (warning.code === 'SOURCEMAP_ERROR') return;
        warn(warning);
      },
    },
  },
});