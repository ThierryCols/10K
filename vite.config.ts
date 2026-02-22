import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // Must match the GitHub repository name for GitHub Pages hosting
  base: '/10K/',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: '10K Scoreboard',
        short_name: '10K',
        description: 'Scoreboard for the 10,000 dice game',
        theme_color: '#1a1a2e',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/10K/',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
    }),
  ],
})
