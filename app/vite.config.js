import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/webhook': {
        target: 'https://n8n-stg.gruntable.com',
        changeOrigin: true,
      }
    }
  }
})

// To switch environments, edit to:
//   STG:  VITE_API_BASE_URL=https://n8n-stg.gruntable.com
//   PROD: VITE_API_BASE_URL=https://grunts.gruntable-api.com
