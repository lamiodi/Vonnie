import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default ({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiUrl = env.VITE_API_URL
  const target = apiUrl ? new URL(apiUrl).origin : undefined

  return defineConfig({
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.png', 'logo.png', 'x2x2i.png'],
        manifest: {
          name: 'Vonne X2X Management System',
          short_name: 'VonneX2X',
          description: 'Complete salon and shop management system with offline support',
          theme_color: '#1f1f1f',
          background_color: '#ffffff',
          display: 'standalone',
          orientation: 'portrait-primary',
          start_url: '/',
          icons: [
            {
              src: 'logo.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'logo.png',
              sizes: '512x512',
              type: 'image/png'
            }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }
              }
            },
            {
              urlPattern: /\/api\/products/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'api-products-cache',
                expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 }
              }
            },
            {
              urlPattern: /\/api\/services/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'api-services-cache',
                expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 }
              }
            }
          ],
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api/, /^\/webhooks/]
        }
      })
    ],
    resolve: {
      alias: {
        '@': '/src'
      }
    },
    server: {
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
