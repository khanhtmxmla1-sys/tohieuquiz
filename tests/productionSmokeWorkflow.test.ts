import fs from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const workflow = fs.readFileSync('.github/workflows/production-smoke.yml', 'utf8').replace(/\r\n/g, '\n');
const jobSource = (name: string) => workflow.split(`\n  ${name}:\n`, 2)[1]?.split(/\n  [a-z][a-z0-9-]*:\n/, 2)[0] || '';
const jobEnv = (name: string) => jobSource(name).match(/\n    env:\n([\s\S]*?)\n    steps:/)?.[1] || '';
const require = createRequire(import.meta.url);
const { load: parseYaml } = require('js-yaml') as { load: (source: string) => unknown };
const workflowDocument = parseYaml(workflow) as {
  jobs: Record<string, { if?: string; environment?: string; env?: Record<string, unknown>; steps?: Array<Record<string, unknown>> }>;
};

type WorkflowContext = {
  github: {
    event_name: string;
    ref: string;
    event: {
      deployment_status: { state: string };
      deployment: { environment: string; ref: string };
    };
  };
  inputs: { action: string; auto_rollback: boolean };
  vars: { PRODUCTION_ROLLOUT_ENABLED: string };
};

const context = ({
  eventName = 'deployment_status',
  ref = '',
  action = 'smoke',
  autoRollback = false,
  state = 'success',
  environment = 'Production',
  deploymentRef = 'preview-sha',
  rolloutEnabled = 'false',
}: Partial<{
  eventName: string;
  ref: string;
  action: string;
  autoRollback: boolean;
  state: string;
  environment: string;
  deploymentRef: string;
  rolloutEnabled: string;
}> = {}): WorkflowContext => ({
  github: {
    event_name: eventName,
    ref,
    event: {
      deployment_status: { state },
      deployment: { environment, ref: deploymentRef },
    },
  },
  inputs: { action, auto_rollback: autoRollback },
  vars: { PRODUCTION_ROLLOUT_ENABLED: rolloutEnabled },
});

const readPath = (value: unknown, path: string) => path.split('.').reduce(
  (current, part) => (current && typeof current === 'object' ? (current as Record<string, unknown>)[part] : undefined),
  value,
);

const tokenize = (expression: string) => expression.match(/\s*(?:\|\||&&|==|!=|\(|\)|true|false|'[^']*'|"[^"]*"|[A-Za-z_][A-Za-z0-9_.-]*)\s*/g)
  ?.map((token) => token.trim()) || [];

const evaluateExpression = (expression: string, values: WorkflowContext) => {
  const tokens = tokenize(expression);
  let index = 0;
  const primary = (): unknown => {
    const token = tokens[index++];
    if (token === '(') {
      const result = orExpression();
      if (tokens[index++] !== ')') throw new Error(`Unbalanced condition for ${jobName}`);
      return result;
    }
    if (token === 'true') return true;
    if (token === 'false') return false;
    if (token?.startsWith("'")) return token.slice(1, -1);
    if (token?.startsWith('"')) return token.slice(1, -1);
    return readPath(values, token || '');
  };
  const comparison = (): unknown => {
    const left = primary();
    const operator = tokens[index];
    if (operator !== '==' && operator !== '!=') return left;
    index += 1;
    const right = primary();
    return operator === '==' ? left === right : left !== right;
  };
  const andExpression = (): unknown => {
    let result = comparison();
    while (tokens[index] === '&&') {
      index += 1;
      const right = comparison();
      result = result && right;
    }
    return result;
  };
  function orExpression(): unknown {
    let result = andExpression();
    while (tokens[index] === '||') {
      index += 1;
      const right = andExpression();
      result = result || right;
    }
    return result;
  }
  const result = orExpression();
  if (index !== tokens.length) throw new Error(`Unsupported workflow expression: ${expression}`);
  return result;
};

const evaluateCondition = (jobName: string, values: WorkflowContext) => Boolean(
  evaluateExpression(String(workflowDocument.jobs[jobName]?.if || ''), values),
);

const evaluateConcurrencyGroup = (values: WorkflowContext) => {
  const source = String((workflowDocument as { concurrency?: { group?: string } }).concurrency?.group || '');
  const expression = source.match(/\$\{\{\s*([\s\S]*?)\s*\}\}/)?.[1];
  if (!expression) throw new Error('Workflow concurrency group is not an expression.');
  return source.replace(/\$\{\{\s*[\s\S]*?\s*\}\}/, String(evaluateExpression(expression, values)));
};

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

  it('uses fixed canonical targets for production jobs and enables runner validation', () => {
    expect(workflow).not.toContain('inputs.site_url');
    expect(workflow).not.toContain('inputs.apex_url');
    expect(workflow).not.toContain('inputs.api_url');
    expect(workflow).not.toContain('inputs.parent_url');
    expect(workflow).toContain('SITE_URL: https://www.thtohieu.com');
    expect(workflow).toContain('APEX_URL: https://thtohieu.com');
    expect(workflow).toContain('API_URL: https://api.thtohieu.com');
    expect(workflow).toContain('PARENT_URL: https://phuhuynh.thtohieu.com');
    expect((workflow.match(/--production-targets/g) || []).length).toBe(4);
  });

  it('parses job conditions and evaluates deployment, manual, and write matrices', () => {
    expect(Object.keys(workflowDocument.jobs)).toEqual(expect.arrayContaining([
      'smoke', 'public-smoke', 'rollout-readonly', 'rollout-write', 'rollout-write-blocked',
    ]));
    const productionSha = context({ eventName: 'deployment_status', ref: '', deploymentRef: 'a'.repeat(40) });
    expect(evaluateCondition('public-smoke', productionSha)).toBe(true);
    expect(evaluateCondition('smoke', productionSha)).toBe(false);
    expect(evaluateCondition('rollout-write', productionSha)).toBe(false);

    expect(evaluateCondition('public-smoke', context({ environment: 'Preview' }))).toBe(false);
    expect(evaluateCondition('public-smoke', context({ state: 'failure' }))).toBe(false);

    const manualMainSmoke = context({
      eventName: 'workflow_dispatch', ref: 'refs/heads/main', action: 'smoke',
    });
    expect(evaluateCondition('public-smoke', manualMainSmoke)).toBe(true);
    expect(evaluateCondition('smoke', manualMainSmoke)).toBe(true);
    expect(evaluateCondition('smoke', context({ eventName: 'workflow_dispatch', ref: 'refs/heads/feature' }))).toBe(false);
    expect(evaluateCondition('smoke', context({ eventName: 'workflow_dispatch', ref: 'refs/tags/main' }))).toBe(false);

    const blockedWrite = context({
      eventName: 'workflow_dispatch', ref: 'refs/heads/feature', action: 'rollout-apply',
      rolloutEnabled: 'false',
    });
    expect(evaluateCondition('rollout-write-blocked', blockedWrite)).toBe(true);
    expect(evaluateCondition('rollout-write', blockedWrite)).toBe(false);
    expect(evaluateCondition('rollout-write', context({
      eventName: 'workflow_dispatch', ref: 'refs/heads/main', action: 'rollout-apply', rolloutEnabled: 'true',
    }))).toBe(true);
  });

  it('uses trusted checkout refs and never checks out a deployment payload SHA', () => {
    expect(workflow).not.toContain('github.event.deployment.sha');
    expect(jobSource('smoke')).toContain('ref: ${{ github.sha }}');
    expect(jobSource('public-smoke')).toContain('ref: refs/heads/main');
    expect(jobSource('rollout-readonly')).toContain('ref: refs/heads/main');
    expect(jobSource('rollout-write')).toContain('ref: ${{ github.sha }}');
    expect(jobSource('public-smoke')).toContain('--public-only');
  });

  it('keeps the public browser smoke job free of production secrets', () => {
    const publicJob = jobSource('public-smoke');
    expect(publicJob).toContain('cypress/e2e/production-smoke.cy.ts');
    expect(publicJob).not.toContain('SMOKE_');
    expect(publicJob).not.toContain('secrets.');
    expect(jobSource('smoke')).toContain('--skip-browser');
  });

  it('scopes smoke credentials to the login step and trusts only main deployment refs', () => {
    const smokeJob = jobSource('smoke');
    expect(jobEnv('smoke')).not.toContain('SMOKE_');
    expect(smokeJob).toContain('github.ref == \'refs/heads/main\'');
    expect(smokeJob).not.toContain('github.event.deployment.ref');
    expect(smokeJob).toContain('ref: ${{ github.sha }}');
    expect(smokeJob).toMatch(/Run read-only production smoke[\s\S]*?env:\n[\s\S]*?SMOKE_ADMIN_USERNAME: \$\{\{ secrets\.SMOKE_ADMIN_USERNAME \}\}/);
  });

  it('separates read-only rollout from fail-closed production writes', () => {
    const readonlyJob = jobSource('rollout-readonly');
    const writeJob = jobSource('rollout-write');
    expect(readonlyJob).toContain('rollout-plan');
    expect(readonlyJob).toContain('rollout-evaluate');
    expect(readonlyJob).not.toContain('SMOKE_ADMIN_');
    expect(readonlyJob).not.toContain('secrets.');
    expect(readonlyJob).toContain('ref: refs/heads/main');
    expect(jobEnv('rollout-write')).not.toContain('SMOKE_');
    expect(writeJob).toContain('environment: production-rollout');
    expect(writeJob).toContain('vars.PRODUCTION_ROLLOUT_ENABLED == \'true\'');
    expect(writeJob).toContain("github.ref == 'refs/heads/main'");
    expect(writeJob).toContain('secrets.SMOKE_ADMIN_USERNAME');
    expect(writeJob).toContain('secrets.SMOKE_ADMIN_PASSWORD');
    expect(writeJob).not.toContain('environment: production-smoke');
    expect(writeJob).toContain('ref: ${{ github.sha }}');
    expect(writeJob).toMatch(/Apply, evaluate, or roll back rollout with protected approval[\s\S]*?env:\n[\s\S]*?SMOKE_ADMIN_USERNAME: \$\{\{ secrets\.SMOKE_ADMIN_USERNAME \}\}/);
  });

  it('keeps workflow concurrency from mixing deployment notifications with writes', () => {
    expect(workflow).toContain('cancel-in-progress: ${{ github.event_name == \'deployment_status\' || inputs.action == \'smoke\' }}');
    expect(jobSource('rollout-write')).not.toContain('cancel-in-progress: true');

    const deploymentWithWriterLikePayload = context({
      eventName: 'deployment_status', action: 'rollout-apply', environment: 'Production',
      deploymentRef: 'running-writer-key',
    });
    const manualApply = context({ eventName: 'workflow_dispatch', ref: 'refs/heads/main', action: 'rollout-apply', rolloutEnabled: 'true' });
    const manualRollback = context({ eventName: 'workflow_dispatch', ref: 'refs/heads/main', action: 'rollout-rollback', rolloutEnabled: 'true' });
    const manualEvaluate = context({ eventName: 'workflow_dispatch', ref: 'refs/heads/main', action: 'rollout-evaluate', rolloutEnabled: 'true' });
    const manualSmoke = context({ eventName: 'workflow_dispatch', ref: 'refs/heads/main', action: 'smoke' });
    expect(evaluateConcurrencyGroup(deploymentWithWriterLikePayload)).toBe('production-smoke-deployment-status');
    expect(evaluateConcurrencyGroup(manualApply)).toBe('production-smoke-rollout');
    expect(evaluateConcurrencyGroup(manualRollback)).toBe(evaluateConcurrencyGroup(manualApply));
    expect(evaluateConcurrencyGroup(manualEvaluate)).toBe(evaluateConcurrencyGroup(manualApply));
    expect(evaluateConcurrencyGroup(deploymentWithWriterLikePayload)).not.toBe(evaluateConcurrencyGroup(manualApply));
    expect(evaluateConcurrencyGroup(manualSmoke)).toBe('production-smoke-smoke');
    expect(evaluateExpression(String((workflowDocument as { concurrency: { 'cancel-in-progress': string } }).concurrency['cancel-in-progress']).match(/\$\{\{\s*([\s\S]*?)\s*\}\}/)?.[1] || '', manualApply)).toBe(false);
    expect(evaluateExpression(String((workflowDocument as { concurrency: { 'cancel-in-progress': string } }).concurrency['cancel-in-progress']).match(/\$\{\{\s*([\s\S]*?)\s*\}\}/)?.[1] || '', deploymentWithWriterLikePayload)).toBe(true);
  });
});
