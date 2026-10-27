/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

import path from 'node:path';

// `base: './'` keeps asset URLs relative so the same build can be served
// by a web host or loaded by the WPF/WebView2 desktop shell (Milestone 2).
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      'three/examples/jsm/loaders/TTFLoader.js': path.resolve(import.meta.dirname, 'src/lib/emptyLoader.ts'),
      'three/examples/jsm/loaders/TTFLoader': path.resolve(import.meta.dirname, 'src/lib/emptyLoader.ts'),
      'https://cdn.jsdelivr.net/npm/opentype.js@1.3.4/+esm': path.resolve(import.meta.dirname, 'src/lib/emptyLoader.ts'),
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      input: {
        main: path.resolve(import.meta.dirname, 'index.html'),
        spike: path.resolve(import.meta.dirname, 'spike-ifc.html'),
        spikeGeometry: path.resolve(import.meta.dirname, 'spike-geometry.html'),
      },
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules/three')) return 'three';
          if (id.includes('node_modules/@thatopen')) return 'thatopen';
          if (id.includes('node_modules/web-ifc')) return 'web-ifc';
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
