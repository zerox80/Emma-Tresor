import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiBase = env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000/api';

  let proxyTarget = apiBase;
  try {
    proxyTarget = new URL(apiBase).origin;
  } catch (error) {
    if (apiBase.startsWith('http')) {
      proxyTarget = apiBase.replace(/\/?api\/?$/, '');
    }
  }

  return {
    plugins: [react()],
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,

          secure: mode === 'production',
          configure: (proxy) => {
            proxy.on('error', (err) => {

              if (mode !== 'production') {
                console.error('Proxy error:', err);
              }
            });
          },
        },
      },
    },
    preview: {
      port: 4173,
      strictPort: true,
    },
    build: {

      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true,
        },
        format: {
          ascii_only: false,
          comments: false,
        },
      },
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
            router: ['react-router-dom'],
          },
        },
      },
    },
  };
});
