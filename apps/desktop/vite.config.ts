import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const currentDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(currentDir, '..', '..');

/**
 * `build/` y `dist/` viven en la raiz del proyecto, no dentro del app.
 * Todas las rutas son relativas: nada de rutas absolutas.
 */
const FRONT_BUILD_DIR = '../../build';
const TAURI_SRC_DIR = './src-tauri';

export default defineConfig({
  plugins: [react(), tailwindcss()],

  // ---------------------------------------------------------------- paths ---
  resolve: {
    alias: {
      '@': resolve(currentDir, 'src'),
    },
  },

  // ------------------------------------------------------------- servidor ---
  server: {
    port: 5273,
    strictPort: true,
    host: '127.0.0.1',
    watch: {
      // Vite no debe vigilar el codigo Rust.
      ignored: [`${TAURI_SRC_DIR}/**`],
    },
  },

  // ---------------------------------------------------------------- build ---
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    outDir: FRONT_BUILD_DIR,
    emptyOutDir: true,
    target: 'esnext',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
  },

  clearScreen: false,
});