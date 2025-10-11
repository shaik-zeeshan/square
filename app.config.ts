import { defineConfig } from '@solidjs/start/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  ssr: false,
  vite: {
    plugins: [tailwindcss()],
  },
  server: {
    watchOptions: {
      ignored: ['**/src-tauri/**'],
    },
  },
});
