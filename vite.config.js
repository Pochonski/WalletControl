import { defineConfig } from 'vite'

export default defineConfig({
  // Raiz del proyecto
  root: '.',

  // Servidor de desarrollo
  server: {
    port: 3000,
    open: true,
  },

  // Build
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
})
