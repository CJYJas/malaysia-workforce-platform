import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, loadEnv } from 'vite';

import runtimeErrorOverlay from '@replit/vite-plugin-runtime-error-modal';

const rawPort = process.env.PORT || '5173';
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH || '/';

const workspaceRoot = path.resolve(import.meta.dirname, '..', '..');
const appRoot = path.resolve(import.meta.dirname);
const loadedEnv = {
  ...loadEnv(process.env.NODE_ENV || 'development', workspaceRoot, ''),
  ...loadEnv(process.env.NODE_ENV || 'development', appRoot, ''),
  ...process.env,
};

const backendApiUrl =
  loadedEnv.VITE_API_URL ||
  loadedEnv.BACKEND_API_URL ||
  loadedEnv.VITE_BACKEND_API_URL ||
  'https://xvu8eu1rakfbfc-8000.proxy.runpod.net';

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== 'production' &&
    process.env.REPL_ID !== undefined
      ? [
          await import('@replit/vite-plugin-cartographer').then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, '..'),
            }),
          ),
          await import('@replit/vite-plugin-dev-banner').then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@assets': path.resolve(
        import.meta.dirname,
        '..',
        '..',
        'attached_assets',
      ),
    },
    dedupe: ['react', 'react-dom'],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/public'),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true,
    fs: {
      strict: true,
    },
    proxy: {
      '/api/py': {
        target: backendApiUrl,
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api\/py/, ''),
      },
      '/api': {
        target: process.env.API_SERVER_URL || 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port,
    host: '0.0.0.0',
    allowedHosts: true,
    proxy: {
      '/api/py': {
        target: backendApiUrl,
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api\/py/, ''),
      },
      '/api': {
        target: process.env.API_SERVER_URL || 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
});
