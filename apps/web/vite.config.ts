import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

const certDir = path.resolve(__dirname, '../../certs');

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiProxyTarget = env.VITE_API_PROXY_TARGET || 'http://localhost:3000';

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    define: {
      __APP_VERSION__: JSON.stringify(env.VITE_APP_VERSION || process.env.VITE_APP_VERSION || '1.0.0'),
    },
    build: {
      target: 'es2020',
      sourcemap: false,
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('react-router-dom') || id.includes('react-router')) return 'router';
            if (id.includes('recharts')) return 'charts';
            if (id.includes('@tanstack/react-query') || id.includes('react-table')) return 'data';
            if (id.includes('react-hook-form') || id.includes('@hookform') || id.includes('zod')) return 'forms';
            if (id.includes('html5-qrcode')) return 'scanner';
            if (id.includes('sonner')) return 'notify';
            return 'vendor';
          },
        },
      },
    },
    server: {
      port: 5173,
      host: '0.0.0.0',
      https: {
        key: fs.readFileSync(path.join(certDir, 'localhost+2-key.pem')),
        cert: fs.readFileSync(path.join(certDir, 'localhost+2.pem')),
      },
      proxy: {
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
        },
        '/uploads': {
          target: apiProxyTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
