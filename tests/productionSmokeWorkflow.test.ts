import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const workflow = fs.readFileSync('.github/workflows/production-smoke.yml', 'utf8');

describe('production smoke workflow contract', () => {
  it('uses protected environment secrets without putting credentials in CLI arguments', () => {
    expect(workflow).toContain('environment: production-smoke');
    for (const secret of [
      'SMOKE_ADMIN_USERNAME', 'SMOKE_ADMIN_PASSWORD',
      'SMOKE_TEACHER_USERNAME', 'SMOKE_TEACHER_PASSWORD',
      'SMOKE_STUDENT_USERNAME', 'SMOKE_STUDENT_PASSWORD',
      'SMOKE_PARENT_ACCESS_CODE', 'SMOKE_PARENT_PIN',
    ]) {
      expect(workflow).toContain(`secrets.${secret}`);
      expect(workflow).not.toMatch(new RegExp(`--[^\\n]*\\$\\{\\{ secrets\\.${secret} \\}\\}`));
    }
  });

  it('installs the Cypress binary for the browser smoke job', () => {
    expect(workflow).toContain('Install locked dependencies and Cypress binary');
    expect(workflow).toContain('run: npm ci');
  });

  it('uploads redacted JSON reports even when a smoke or rollout step fails', () => {
    expect(workflow).toContain('if: always()');
    expect(workflow).toContain('reports/production-smoke.json');
    expect(workflow).toContain('reports/staged-rollout.json');
    expect(workflow).toContain('retention-days: 14');
  });

  it('contains no deploy command and keeps mutation namespaces outside production', () => {
    expect(workflow).not.toMatch(/wrangler deploy|vercel deploy|npm run deploy/);
    expect(workflow).toContain('mutation_namespace');
    expect(workflow).toContain('- staging');
    expect(workflow).toContain('- test');
    expect(workflow).not.toContain('- production');
  });
});
