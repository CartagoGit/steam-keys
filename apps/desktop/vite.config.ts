import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { devBridgePlugin, devBridgeStubPlugin } from './dev-bridge.vite-plugin';
import { puertoVite } from '../../tools/scripts/support/puertos.helper';

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
    /**
     * 4200 para `bun run dev` y 4500 para `bun run web`.
     *
     * El puerto lo pasa `web.script.ts` con `PUERTO_VITE` en vez de hardcodeado
     * aqui, porque si no el script no podria mirar si el puerto esta libre
     * antes de lanzar: miraria el de `dev` y creeria que esta ocupado cuando
     * lo que hay es un `web` de hace un rato.
     *
     * `strictPort` para que, si aun asi esta ocupado, Vite falle en vez de
     * cogerse el siguiente libre: si se moviera solo, la URL que dice el
     * aviso no seria la que hay que abrir y se acabaria probando en la
     * ventana equivocada.
     */
    port: puertoVite(),
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