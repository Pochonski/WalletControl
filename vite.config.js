import { defineConfig } from 'vite'

export default defineConfig({
  // Raiz del proyecto
  root: '.',

  // Servidor de desarrollo
  server: {
    host: '0.0.0.0', // Permite acceso desde cualquier IP en la red
    port: 3000,
    open: true,
  },

  // Build
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
})
