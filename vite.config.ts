import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { cloudflare } from '@cloudflare/vite-plugin';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const proxyTarget = env.VITE_DEV_API_PROXY_TARGET?.trim() || 'http://127.0.0.1:8787';

  return {
    server: {
      port: 3001,
      host: '0.0.0.0',
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
          rewrite: (requestPath) => requestPath,
        },
      },
    },
    plugins: [react(), cloudflare()],
    resolve: {
      alias: { '@': path.resolve(__dirname, '.') },
    },
    build: {
      esbuild: {
        drop: mode === 'production' ? ['console'] : [],
      },
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom'],
            'vendor-icons': ['lucide-react'],
            'vendor-state': ['zustand'],
            'vendor-motion': ['framer-motion'],
          },
        },
      },
      chunkSizeWarningLimit: 500,
    },
  };
});
