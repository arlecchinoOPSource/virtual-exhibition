import { defineConfig } from '@playwright/test';
import { createHash } from 'node:crypto';
import { testGalleryPassword } from './tests/e2e/gallery-entry';

export default defineConfig({
  testDir: 'tests/e2e',
  // Pointer capture releases when another browser window takes focus.
  workers: 1,
  use: { baseURL: 'http://localhost:4173' },
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        launchOptions: {
          args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
        },
      },
    },
    { name: 'firefox', use: { browserName: 'firefox' } },
  ],
  webServer: {
    command: 'npm run dev -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: false,
    env: {
      VITE_GALLERY_PASSWORD_DIGEST: createHash('sha256')
        .update(testGalleryPassword)
        .digest('hex'),
    },
  },
});
