import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolveReleaseId } from './src/config/releaseId';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const proxyTarget = env.VITE_DEV_API_PROXY_TARGET?.trim() || 'http://127.0.0.1:8787';
  const appRelease = resolveReleaseId({
    explicitRelease: process.env.VITE_APP_RELEASE || env.VITE_APP_RELEASE,
    vercelCommitSha: process.env.VERCEL_GIT_COMMIT_SHA,
    githubSha: process.env.GITHUB_SHA,
  });

  return {
    define: {
      'import.meta.env.VITE_APP_RELEASE': JSON.stringify(appRelease),
    },
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
    // The frontend is deployed by Vercel. During local development `/api` is proxied to the
    // separately running Cloudflare Worker, so page requests must stay in Vite rather than pass
    // through workerd's assets layer. That layer produced intermittent empty 500 responses on Windows.
    plugins: [react()],
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
