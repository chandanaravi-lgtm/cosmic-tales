import { defineConfig } from 'vite';

// `npm run dev` / `npm run serve` -> http://localhost:8000
// allowedHosts: true so the app also works behind a preview proxy / tunnel
// (Vite otherwise answers "Blocked request" for any host but localhost).
export default defineConfig({
  // relative asset URLs so the app also works under a path prefix (e.g. the
  // Agent Mode preview proxy /sandbox/v1/preview/8000/ or a sub-folder deploy)
  base: './',
  server: { host: true, port: 8000, allowedHosts: true },
  preview: { host: true, port: 8000, allowedHosts: true },
  build: { target: 'es2022', chunkSizeWarningLimit: 1200 },
});
