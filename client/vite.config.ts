import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react({
    jsxImportSource: '@emotion/react',
    babel: {
      plugins: ['@emotion/babel-plugin'],
    },
  })],
  build: {
    outDir: 'build',
    // Large limit to avoid warning on stderr during build
    chunkSizeWarningLimit: 100000000,
  },
  server: {
    port: 5003,
    host: '0.0.0.0',
  },
  resolve: {
    alias: {
      'check-type': path.resolve(__dirname, "src/shared/common/check-type/index"),
    }
  }
})
