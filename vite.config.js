import { defineConfig } from 'vite'
import path from 'path'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    global: 'globalThis',
    'process.env': {
      NODE_ENV: JSON.stringify(process.env.NODE_ENV),
      VITE_INFURA_PROJECT_ID: JSON.stringify(process.env.VITE_INFURA_PROJECT_ID),
      VITE_INFURA_API_SECRET: JSON.stringify(process.env.VITE_INFURA_API_SECRET),
      VITE_SIGNALING_SERVER_URL: JSON.stringify(process.env.VITE_SIGNALING_SERVER_URL)
    }
  },
  resolve: {
    alias: [
      { find: 'simple-peer', replacement: 'simple-peer/simplepeer.min.js' },
      { find: 'buffer', replacement: 'buffer' },
      // onnxruntime-web's exports map hides dist/*; these let the
      // transcription worker ?url-import the WASM runtime so it is
      // served same-origin instead of transformers.js's jsdelivr default
      // (which the production CSP blocks)
      { find: /^@ort-asyncify-wasm/, replacement: path.resolve(__dirname, 'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.wasm') },
      { find: /^@ort-asyncify-mjs/, replacement: path.resolve(__dirname, 'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.mjs') }
    ]
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
          ui: ['react-hot-toast', 'react-grid-layout', 'react-resizable', 'react-rnd', 'react-router-dom'],
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
