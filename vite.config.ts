import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    // Make the dev server reachable on the LAN and allow the localtunnel host
    host: true,
    port: 5173,
    allowedHosts: ['stock-table-planner.loca.lt']
  }
});
