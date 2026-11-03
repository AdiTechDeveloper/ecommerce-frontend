import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Dev mein /api ki requests Laravel (php artisan serve) ko bhej di jaati hain,
// isliye CORS ka jhanjhat nahi hota.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    host: true, // phone se same WiFi pe http://<PC-ka-IP>:5173 khol sako
    proxy: {
      '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true },
    },
  },
});
