import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    historyApiFallback: true,
    proxy: {
      '/webhook': {
        target: 'https://n8n-stg.gruntable.com',
        changeOrigin: true,
      }
    }
  }
})

// To switch n8n environments, edit .env:
//   STG:  VITE_N8N_BASE_URL=https://n8n-stg.gruntable.com
//   PROD: VITE_N8N_BASE_URL=https://grunts.gruntable-api.com
