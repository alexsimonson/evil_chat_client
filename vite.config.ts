import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from "fs";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3002,
    strictPort: true, // fail instead of auto-switching
    host: true,
    https: {
      key: fs.readFileSync("./certs/key.pem"),
      cert: fs.readFileSync("./certs/cert.pem"),
    },
    proxy: {
      // Proxy API-related requests to the backend so the browser sees same-origin
      '/auth': {
        target: 'http://192.168.1.22:666',
        changeOrigin: true,
        secure: false,
        // Remove or rewrite Set-Cookie domain so browsers accept the cookie on the dev server host
        cookieDomainRewrite: "",
      },
      '/servers': {
        target: 'http://192.168.1.22:666',
        changeOrigin: true,
        secure: false,
        cookieDomainRewrite: "",
      },
      '/channels': {
        target: 'http://192.168.1.22:666',
        changeOrigin: true,
        secure: false,
        cookieDomainRewrite: "",
      },
      '/livekit': {
        target: 'http://192.168.1.22:666',
        changeOrigin: true,
        secure: false,
        ws: true,
        cookieDomainRewrite: "",
      },
    },
  }
})
