import { defineConfig, loadEnv } from 'vite';                // Import Vite configuration utilities
import react from '@vitejs/plugin-react';                    // Import React plugin for Vite

// Export Vite configuration with environment-based settings
export default defineConfig(({ mode }) => {
  // Load environment variables based on current mode (development/production)
  const env = loadEnv(mode, process.cwd(), '');
  // Set API base URL from environment or fallback to local development server
  const apiBase = env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000/api';

  // Determine proxy target for API requests
  let proxyTarget = apiBase;
  try {
    // Try to parse API base URL and extract origin for proxy
    proxyTarget = new URL(apiBase).origin;
  } catch (error) {
    // Fallback for malformed URLs - remove /api suffix if present
    if (apiBase.startsWith('http')) {
      proxyTarget = apiBase.replace(/\/?api\/?$/, '');
    }
  }

  // Return configuration object
  return {
    plugins: [react()],                                      // Enable React plugin with Fast Refresh
    server: {
      port: 5173,                                           // Development server port
      strictPort: true,                                      // Fail if port is occupied
      proxy: {
        // Proxy API requests to backend server
        '/api': {
          target: proxyTarget,                               // Backend server URL
          changeOrigin: true,                                // Change Host header to target URL
          secure: mode === 'production',                     // SSL verification only in production
          configure: (proxy) => {
            // Handle proxy errors gracefully
            proxy.on('error', (err) => {
              // Only log proxy errors in development mode
              if (mode !== 'production') {
                console.error('Proxy error:', err);
              }
            });
          },
        },
      },
    },
    preview: {
      port: 4173,                                           // Production preview server port
      strictPort: true,                                      // Fail if port is occupied
    },
    build: {
      minify: 'terser',                                      // Use Terser for minification
      terserOptions: {
        // Configure Terser options for production optimization
        compress: {
          drop_console: true,                                // Remove console.log statements
          drop_debugger: true,                               // Remove debugger statements
        },
        format: {
          ascii_only: false,                                 // Allow Unicode characters
          comments: false,                                   // Remove comments from output
        },
      },
      rollupOptions: {
        output: {
          // Manual chunk splitting for better caching
          manualChunks: {
            vendor: ['react', 'react-dom'],                  // Core React libraries
            router: ['react-router-dom'],                   // Routing library
          },
        },
      },
    },
  };
});
