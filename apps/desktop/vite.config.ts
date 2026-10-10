import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { devBridgePlugin, devBridgeStubPlugin } from './dev-bridge.vite-plugin';

const currentDir = dirname(fileURLToPath(import.meta.url));

/**
 * `build/` y `dist/` viven en la raiz del proyecto, no dentro del app.
 * Todas las rutas son relativas: nada de rutas absolutas.
 */
const FRONT_BUILD_DIR = '../../build';
const TAURI_SRC_DIR = './src-tauri';

export default defineConfig({
  // El puente solo existe en `bun run dev`: el primero lleva `apply: 'serve'`
  // y se lleva por delante el endpoint, el segundo lleva `apply: 'build'` y
  // borra el cliente del bundle. El ejecutable de Windows nunca lleva la puerta
  // abierta, ni el codigo que la abriria.
  plugins: [react(), tailwindcss(), devBridgePlugin(), devBridgeStubPlugin()],

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