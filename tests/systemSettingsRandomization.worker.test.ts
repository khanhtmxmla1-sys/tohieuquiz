// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  verify: vi.fn(),
  requireAdmin: vi.fn(),
  audits: [] as any[],
}));

vi.mock('../workers/src/middleware/jwtAuth', () => ({
  verifyJWTMiddleware: mocks.verify,
  requireAdmin: mocks.requireAdmin,
}));

vi.mock('../workers/src/utils/audit', () => ({
  auditStatement: (_db: unknown, entry: unknown) => ({
    run: async () => {
      mocks.audits.push(entry);
      return { success: true, meta: { changes: 1 } };
    },
  }),
}));

import { handleSystemSettingsRoutes } from '../workers/src/routes/systemSettings';

class SettingStatement {
  private bindings: unknown[] = [];
  constructor(private readonly db: SettingsD1, private readonly sql: string) {}
  bind(...values: unknown[]) { this.bindings = values; return this; }
  async all<T>() {
    if (!this.sql.includes('FROM system_settings')) return { results: [] as T[] };
    const requested = new Set(this.bindings.map(String));
    const results = [...this.db.settings.entries()]
      .filter(([key]) => requested.size === 0 || requested.has(key))
      .map(([setting_key, row]) => ({ setting_key, ...row })) as T[];
    return { results };
  }
  async run() {
    if (this.sql.includes('INSERT INTO system_settings')) {
      const [key, value, updatedAt] = this.bindings.map(String);
      this.db.settings.set(key, { setting_value: value, updated_at: updatedAt });
    }
    return { success: true, meta: { changes: 1 } };
  }
}

class SettingsD1 {
  settings = new Map<string, { setting_value: string; updated_at: string }>([
    ['ai_assistant_enabled', { setting_value: 'true', updated_at: '2026-08-01T00:00:00.000Z' }],
    ['unified_notifications_v1', { setting_value: 'false', updated_at: '2026-08-01T00:00:00.000Z' }],
  ]);
  prepare(sql: string) { return new SettingStatement(this, sql); }
  async batch(statements: Array<{ run: () => Promise<unknown> }>) {
    return Promise.all(statements.map((statement) => statement.run()));
  }
}

const makeEnv = () => ({ DB: new SettingsD1() }) as any;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.audits.length = 0;
  mocks.verify.mockResolvedValue({ user: { username: 'admin', role: 'admin' } });
  mocks.requireAdmin.mockImplementation((user: any) => user?.role === 'admin');
});

describe('system settings randomization policy', () => {
  it('returns legacy-compatible randomization defaults when no randomization rows exist', async () => {
    const response = await handleSystemSettingsRoutes(
      new Request('https://api.test/api/system-settings'),
      makeEnv(),
      '/api/system-settings',
      'GET',
    );
    const payload = await response?.json() as any;

    expect(response?.status).toBe(200);
    expect(payload.data.randomization).toEqual({
      enabled: true,
      shuffleQuestions: true,
      shuffleChoices: false,
      shuffleMatching: true,
      shuffleOrdering: true,
      shuffleDragDrop: true,
      randomizePracticeSelection: true,
    });
  });

  it('allows admin to save randomization settings without overwriting legacy settings', async () => {
    const env = makeEnv();
    const body = {
      enabled: false,
      shuffleQuestions: false,
      shuffleChoices: true,
      shuffleMatching: false,
      shuffleOrdering: true,
      shuffleDragDrop: false,
      randomizePracticeSelection: false,
    };
    const response = await handleSystemSettingsRoutes(
      new Request('https://api.test/api/system-settings/randomization', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-request-id': 'req-randomization' },
        body: JSON.stringify(body),
      }),
      env,
      '/api/system-settings/randomization',
      'POST',
    );
    const payload = await response?.json() as any;

    expect(response?.status).toBe(200);
    expect(payload.data.randomization).toEqual(body);
    expect(env.DB.settings.get('ai_assistant_enabled')?.setting_value).toBe('true');
    expect(env.DB.settings.get('unified_notifications_v1')?.setting_value).toBe('false');
    expect(mocks.audits.at(-1)).toMatchObject({
      actorUsername: 'admin',
      action: 'SYSTEM_SETTINGS_UPDATED',
      targetType: 'system_setting',
      targetId: 'quiz_randomization_policy',
    });
  });

  it('rejects randomization writes from non-admin users', async () => {
    mocks.verify.mockResolvedValueOnce({ user: { username: 'teacher-a', role: 'teacher' } });
    const response = await handleSystemSettingsRoutes(
      new Request('https://api.test/api/system-settings/randomization', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ enabled: false }),
      }),
      makeEnv(),
      '/api/system-settings/randomization',
      'POST',
    );
    expect(response?.status).toBe(403);
  });
});
