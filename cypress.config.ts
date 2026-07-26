import { defineConfig } from 'cypress';

export default defineConfig({
  allowCypressEnv: false,
  e2e: {
    baseUrl: 'http://localhost:3001',
    supportFile: false,
    specPattern: 'cypress/e2e/**/*.cy.{js,ts}',
    viewportWidth: 1280,
    viewportHeight: 720,
    video: false,
    screenshotOnRunFailure: true,
  },

  component: {
    supportFile: 'cypress/support/component.ts',
    specPattern: 'cypress/component/**/*.cy.{js,jsx,ts,tsx}',
    screenshotsFolder: 'artifacts/math-screenshots',
    video: false,
    screenshotOnRunFailure: true,
    devServer: {
      framework: 'react',
      bundler: 'vite',
    },
  },
});
