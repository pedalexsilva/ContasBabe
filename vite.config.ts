import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    // O Capacitor serve o bundle de file:// dentro do WebView.
    assetsDir: 'assets',
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
