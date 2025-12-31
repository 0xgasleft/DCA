import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  assetsInclude: ['**/terms-of-service.html'],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Split large vendor libraries into separate chunks
          'vendor-ethers': ['ethers'],
          'vendor-react': ['react', 'react-dom'],
          'vendor-icons': ['react-icons/fa'],
          'vendor-ui': ['sonner', '@vercel/analytics', '@vercel/speed-insights/react'],
        }
      }
    },
    chunkSizeWarningLimit: 600, // Increase limit slightly as we've optimized
  }
})
