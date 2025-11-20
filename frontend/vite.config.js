import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default ({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Derive origin from VITE_API_URL (e.g., http://localhost:5002/api -> http://localhost:5002)
  const apiUrl = env.VITE_API_URL
  const target = apiUrl ? new URL(apiUrl).origin : undefined

  return defineConfig({
    plugins: [react()],
    resolve: {
      alias: {
        '@': '/src'
      }
    },
    server: {
      // Remove hardcoded port; let Vite choose or use CLI/env
      proxy: target
        ? {
            '/api': {
              target,
              changeOrigin: true,
              secure: false,
            },
          }
        : undefined,
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
    },
  })
}
