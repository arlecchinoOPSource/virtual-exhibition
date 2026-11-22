import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const page = (name: string) =>
  fileURLToPath(new URL(`./${name}.html`, import.meta.url));

export default defineConfig({
  build: {
    rollupOptions: {
      input: { main: page('index'), directory: page('directory') },
    },
  },
  test: { include: ['tests/unit/**/*.test.ts'] },
});
