import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages serve il sito del repo sotto https://giolendius.github.io/InCorporeSano/
export default defineConfig({
  base: '/InCorporeSano/',
  plugins: [react()],
  server: {
    port: 5178,
  },
})
