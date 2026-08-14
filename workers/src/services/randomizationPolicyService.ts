import type { D1Database } from '@cloudflare/workers-types';
import {
  DEFAULT_RANDOMIZATION_POLICY,
  RANDOMIZATION_FIELDS,
  RANDOMIZATION_SETTING_KEY_BY_FIELD,
  resolveEffectiveRandomizationPolicy,
  type RandomizationPolicy,
} from '../../../shared/randomization-policy.contract';

type RandomizationSettingRow = {
  setting_key: string;
  setting_value: string;
};

const parseBooleanSetting = (value: unknown, fallback: boolean): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'true' || normalized === '1') return true;
  if (normalized === 'false' || normalized === '0') return false;
  return fallback;
};

export async function loadRandomizationPolicy(db: D1Database): Promise<RandomizationPolicy> {
  try {
    const keys = RANDOMIZATION_FIELDS.map((field) => RANDOMIZATION_SETTING_KEY_BY_FIELD[field]);
    const rows = await db.prepare(`
      SELECT setting_key, setting_value
      FROM system_settings
      WHERE setting_key IN (?, ?, ?, ?, ?, ?, ?)
    `).bind(...keys).all<RandomizationSettingRow>();
    const byKey = new Map((rows.results || []).map((row) => [row.setting_key, row.setting_value]));
    const raw = Object.fromEntries(RANDOMIZATION_FIELDS.map((field) => [
      field,
      parseBooleanSetting(
        byKey.get(RANDOMIZATION_SETTING_KEY_BY_FIELD[field]),
        DEFAULT_RANDOMIZATION_POLICY[field],
      ),
    ])) as unknown as RandomizationPolicy;
    return resolveEffectiveRandomizationPolicy(raw);
  } catch (error) {
    console.warn('[randomization-policy] Using legacy-compatible defaults after settings read failure:', error);
    return resolveEffectiveRandomizationPolicy(DEFAULT_RANDOMIZATION_POLICY);
  }
}
