import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { normalizeLogRouteTemplate } from '../workers/src/utils/logger';

describe('observability operational contracts', () => {
  it('normalizes dynamic identifiers out of Worker route templates', () => {
    expect(normalizeLogRouteTemplate('/api/results/42?token=secret')).toBe('/api/results/:id');
    expect(normalizeLogRouteTemplate('/api/gift-shop/orders/order-123/approve'))
      .toBe('/api/gift-shop/orders/:id/approve');
    expect(normalizeLogRouteTemplate('/api/health')).toBe('/api/health');
  });

  it('documents every alert with an owner, cooldown and runbook', () => {
    const thresholds = readFileSync('docs/operations/alert-thresholds.md', 'utf8');
    for (const alert of [
      'API 5xx',
      'Login failures',
      'Rate limit 429',
      'Queue/DLQ',
      'Certificate failures',
      'AI failures and cost',
    ]) {
      expect(thresholds).toContain(alert);
    }
    expect(thresholds.match(/Owner:/g)?.length).toBeGreaterThanOrEqual(6);
    expect(thresholds.match(/Cooldown:/g)?.length).toBeGreaterThanOrEqual(6);
    expect(thresholds.match(/Runbook:/g)?.length).toBeGreaterThanOrEqual(6);
  });
});
