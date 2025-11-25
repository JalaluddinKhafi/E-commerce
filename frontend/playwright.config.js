import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : { channel: 'chromium' },
  },
  webServer: [
    {
      command:
        'java -jar target/freshshop-1.0.0.jar --spring.datasource.url=jdbc:h2:mem:e2e --spring.jpa.hibernate.ddl-auto=create-drop',
      cwd: '../backend',
      env: {
        ADMIN_EMAIL: 'manager@example.test',
        ADMIN_PASSWORD: 'Test-only-password-123!',
        JWT_SECRET: 'test-only-signing-key-at-least-32-bytes-long',
      },
      url: 'http://127.0.0.1:8080/api/health',
      timeout: 90_000,
    },
    { command: 'npm run dev', url: 'http://127.0.0.1:5173', timeout: 30_000 },
  ],
});
