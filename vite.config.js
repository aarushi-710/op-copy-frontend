import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Allow all hosts
    allowedHosts: ['785494a4c534.ngrok-free.app', 'localhost', '127.0.0.1'],
    proxy: {
      '/images': {
        target: process.env.VITE_BACKEND_URL || 'http://localhost:5100',
        changeOrigin: true,
      },
    },
  },
  define: {
    'process.env.VITE_BACKEND_URL': JSON.stringify(process.env.VITE_BACKEND_URL || 'http://localhost:5100'),
  },
});