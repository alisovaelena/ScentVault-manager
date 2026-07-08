
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // Build stamp shown in the cloud menu — tells us WHICH version a device runs.
    __BUILD_ID__: JSON.stringify(new Date().toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })),
  },
  server: {
    port: 3000
  }
});
