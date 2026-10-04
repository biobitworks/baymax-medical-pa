import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  use: { baseURL: 'http://localhost:4178', ...devices['Pixel 7'], serviceWorkers: 'allow' },
  webServer: { command: 'npm run preview -- --port 4178 --strictPort', url: 'http://localhost:4178', reuseExistingServer: false },
});
