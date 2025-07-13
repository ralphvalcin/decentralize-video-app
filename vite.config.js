import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    global: 'globalThis',
    'process.env': {
      NODE_ENV: JSON.stringify(process.env.NODE_ENV),
      VITE_INFURA_PROJECT_ID: JSON.stringify(process.env.VITE_INFURA_PROJECT_ID),
      VITE_INFURA_API_SECRET: JSON.stringify(process.env.VITE_INFURA_API_SECRET)
    }
  },
  resolve: {
    alias: {
      'simple-peer': 'simple-peer/simplepeer.min.js',
      'buffer': 'buffer'
    }
  },
  optimizeDeps: {
    include: ['simple-peer', 'buffer']
  },
  server: {
    port: 5173,
    host: true
  }
})
