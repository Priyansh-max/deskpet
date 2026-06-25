import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// Plain Vite config for the Tauri frontend (the React renderer).
export default defineConfig({
  root: 'src/renderer',
  base: './',
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true
  },
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    // Two HTML entry points: the always-loaded taskbar chip and the settings
    // window (loaded lazily via WebviewUrl::App("settings.html")).
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/renderer/index.html'),
        settings: resolve(__dirname, 'src/renderer/settings.html')
      }
    }
  },
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared')
    }
  }
})
