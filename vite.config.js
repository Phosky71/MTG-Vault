import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
    root: '.',
    plugins: [
        tailwindcss(),

        VitePWA({
            registerType: 'autoUpdate',
            devOptions: { enabled: false },
            includeAssets: ['icons/*.png', 'fonts/*.woff2'],

            manifest: {
                name: 'MTG Vault',
                short_name: 'MTGVault',
                description: 'Gestor de colección Magic: The Gathering',
                start_url: '/',
                display: 'standalone',
                background_color: '#0f172a',
                theme_color: '#0f172a',
                orientation: 'portrait-primary',
                lang: 'es',
                icons: [
                    { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
                    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable any' },
                ],
            },

            workbox: {
                cleanupOutdatedCaches: true,
                skipWaiting: true,
                clientsClaim: true,
                globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],

                runtimeCaching: [
                    {
                        urlPattern: /^https:\/\/api\.scryfall\.com\//,
                        handler: 'NetworkFirst',
                        options: {
                            cacheName: 'scryfall-api',
                            expiration: { maxAgeSeconds: 3600, maxEntries: 200 },
                            networkTimeoutSeconds: 5,
                            cacheableResponse: { statuses: [0, 200] },
                        },
                    },
                    {
                        urlPattern: /^https:\/\/cards\.scryfall\.io\//,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'scryfall-images',
                            expiration: { maxEntries: 1000, maxAgeSeconds: 30 * 24 * 60 * 60 },
                            cacheableResponse: { statuses: [0, 200] },
                        },
                    },
                    {
                        urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//,
                        handler: 'StaleWhileRevalidate',
                        options: {
                            cacheName: 'google-fonts',
                            expiration: { maxAgeSeconds: 365 * 24 * 60 * 60 },
                        },
                    },
                ],
            },
        }),
    ],

    build: {
        outDir: 'dist',
        minify: 'terser',
        sourcemap: false,
        rollupOptions: {
            output: {
                manualChunks: {
                    scryfall: ['./src/api/scryfall.js'],
                    core:     ['./src/core/state.js', './src/core/storage.js', './src/core/db.js'],
                    views:    [
                        './src/views/collection.js',
                        './src/views/decks.js',
                        './src/views/dashboard.js',
                        './src/views/search.js',
                        './src/views/wishlist.js',
                    ],
                },
            },
        },
    },
});
