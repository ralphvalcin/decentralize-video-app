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
  build: {
    chunkSizeWarningLimit: 600, // Increase warning limit slightly
    rollupOptions: {
      output: {
        manualChunks: {
          // Separate vendor libraries
          vendor: ['react', 'react-dom'],
          webrtc: ['simple-peer'],
          ui: ['react-hot-toast', 'react-grid-layout', 'react-resizable', 'react-rnd'],
          routing: ['react-router-dom'],
          socket: ['socket.io-client'],
          state: ['zustand'],
          crypto: ['crypto-js', 'bcryptjs', 'jsonwebtoken'],
          utils: ['lodash-es', 'dompurify']
        }
      }
    },
    // Enable compression and optimization
    minify: 'esbuild',
    sourcemap: false, // Disable source maps for production
    cssCodeSplit: true,
    target: 'esnext',
    // Split into smaller chunks
    cssMinify: true
  },
  server: {
    port: 5173,
    host: true
  }
})
