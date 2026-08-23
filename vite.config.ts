import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // GitHub Pages serves this project at /finch/, so assets need that prefix.
  // Local dev and other hosts stay at the root.
  base: process.env.GITHUB_PAGES === 'true' ? '/finch/' : '/',
})
