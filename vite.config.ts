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
    // Os testes de domínio não precisam de DOM, mas os de ecrã precisam, e
    // separar em dois projetos custava mais do que o jsdom demora a arrancar.
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
})
