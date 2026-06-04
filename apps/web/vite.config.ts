import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '');

  return {
    plugins: [react()],
    envDir: __dirname,
    define: {
      'import.meta.env.VITE_RAPIDAPI_KEY': JSON.stringify(env.VITE_RAPIDAPI_KEY ?? ''),
      'import.meta.env.VITE_RAPIDAPI_HOST': JSON.stringify(
        env.VITE_RAPIDAPI_HOST ?? 'youtube-v31.p.rapidapi.com',
      ),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@radius/shared-types': path.resolve(__dirname, '../../packages/shared-types/src'),
        '@radius/geo-utils': path.resolve(__dirname, '../../packages/geo-utils/src'),
        '@radius/websocket-sdk': path.resolve(__dirname, '../../packages/websocket-sdk/src'),
      },
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
        '/socket.io': {
          target: 'http://localhost:3000',
          ws: true,
          changeOrigin: true,
        },
      },
    },
  };
});
