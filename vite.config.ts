import { defineConfig, loadEnv } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'


function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

export default defineConfig(({ mode }) => {
  // Load .env (all vars, no prefix filter) so we can inject the Foursquare key
  // into the dev proxy server-side — it is never exposed to the browser bundle.
  const env = loadEnv(mode, process.cwd(), '')
  const FSQ_KEY = env.VITE_FOURSQUARE_API_KEY || env.FOURSQUARE_API_KEY || ''

  return {
    plugins: [
      figmaAssetResolver(),
      // The React and Tailwind plugins are both required for Make, even if
      // Tailwind is not being actively used – do not remove them
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        // Alias @ to the src directory
        '@': path.resolve(__dirname, './src'),
      },
    },

    // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
    assetsInclude: ['**/*.svg', '**/*.csv'],
    // Dev-only proxy: the browser can't call Foursquare directly (CORS preflight
    // is rejected), so /api/foursquare is proxied here with the Bearer key added
    // server-side. In production a Netlify Function (netlify/functions/foursquare.js)
    // serves the same path — see netlify.toml.
    server: {
      watch: {
        usePolling: true,
      },
      proxy: {
        '/api/foursquare': {
          target: 'https://places-api.foursquare.com',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/foursquare/, '/places/search'),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              if (FSQ_KEY) proxyReq.setHeader('Authorization', `Bearer ${FSQ_KEY}`)
              proxyReq.setHeader('X-Places-Api-Version', '2025-06-17')
              proxyReq.setHeader('Accept', 'application/json')
            })
          },
        },
      },
    },
  }
})
