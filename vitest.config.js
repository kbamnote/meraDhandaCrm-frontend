import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.js'],
    include: ['test/**/*.test.jsx'],
    // A render crash often surfaces as an unhandled rejection rather than a
    // thrown error; failing on those keeps a broken screen from passing quietly.
    dangerouslyIgnoreUnhandledErrors: false,
  },
});
