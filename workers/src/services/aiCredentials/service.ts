import type {
  AiCredentialSummary,
  PersonalAiProvider,
  QuizAiSource,
} from '../../../../shared/teacher-ai-credentials.contract';
import type { Env } from '../../types';
import { getFeatureFlag, resolveFeatureFlag } from '../featureFlagService';
import { decryptCredential, encryptCredential } from './crypto';
import {
  AiCredentialRepositoryError,
  deleteCredential,
  getAiDefaultSource,
  getStoredCredential,
  insertCredentialAudit,
  listCredentialSummaries,
  markCredentialVerified,
  saveCredential,
  saveAiDefaultSource,
  type CredentialAuditRecord,
} from './repository';
import {
  AiCredentialProviderError,
  PERSONAL_AI_PROVIDER_MODELS,
  testProviderCredential,
} from './providerClient';

export type AiCredentialServiceCode =
  | 'AI_KEY_MISSING'
  | 'AI_KEY_VERSION_CONFLICT'
  | 'AI_BYOK_DISABLED'
  | 'AI_VAULT_UNAVAILABLE';

export class AiCredentialServiceError extends Error {
  constructor(public readonly code: AiCredentialServiceCode) {
    super(code);
    this.name = 'AiCredentialServiceError';
  }
}

export const AI_CREDENTIAL_CAPABILITIES = {
  text: true,
  documents: false,
  images: false,
  ocr: false,
  webSearch: false,
  imageGeneration: false,
} as const;

type StaffRole = 'teacher' | 'admin';

const emptySummary = (provider: PersonalAiProvider): AiCredentialSummary => ({
  provider,
  configured: false,
  last4: null,
  version: 0,
  verifiedAt: null,
  updatedAt: null,
});

const summaryFor = (
  summaries: AiCredentialSummary[],
  provider: PersonalAiProvider,
): AiCredentialSummary => summaries.find((item) => item.provider === provider) ?? emptySummary(provider);

const createAuditRecord = (input: {
    owner: string;
    role: StaffRole;
    eventType: 'AI_KEY_SAVED' | 'AI_KEY_DELETED' | 'AI_KEY_TESTED';
    provider: PersonalAiProvider;
    operation: 'save' | 'test' | 'delete';
    resultCode: string;
    requestId: string;
  }): CredentialAuditRecord => {
  const requestId = String(input.requestId || '').replace(/[\r\n\t]/g, ' ').trim().slice(0, 128)
    || `request-${crypto.randomUUID()}`;
  return {
    id: `ai-key-audit-${crypto.randomUUID()}`,
    ...input,
    requestId,
    createdAt: new Date().toISOString(),
  };
};

const audit = async (
  env: Env,
  input: Parameters<typeof createAuditRecord>[0],
): Promise<void> => {
  try {
    await insertCredentialAudit(env.DB, createAuditRecord(input));
  } catch {
    console.error('[AI Credentials] Audit unavailable');
  }
};

export async function isTeacherAiByokEnabled(
  env: Env,
  owner: string,
  role: StaffRole,
): Promise<boolean> {
  const config = await getFeatureFlag(env.DB, 'teacher_ai_byok_v1');
  if (!config) return false;
  const resolution = await resolveFeatureFlag(config, {
    role: role === 'admin' ? 'teacher' : role,
    username: owner,
  });
  return resolution.enabled;
}

export async function getAiCredentialState(
  env: Env,
  owner: string,
  role: StaffRole,
): Promise<{
  enabled: boolean;
  capabilities: typeof AI_CREDENTIAL_CAPABILITIES;
  credentials: AiCredentialSummary[];
  defaultSource: QuizAiSource;
}> {
  const [enabled, summaries, defaultSource] = await Promise.all([
    isTeacherAiByokEnabled(env, owner, role),
    listCredentialSummaries(env.DB, owner),
    getAiDefaultSource(env.DB, owner),
  ]);
  return {
    enabled,
    defaultSource,
    capabilities: AI_CREDENTIAL_CAPABILITIES,
    credentials: [
      summaryFor(summaries, 'gemini'),
      summaryFor(summaries, 'deepseek'),
    ],
  };
}

const assertEnabled = async (env: Env, owner: string, role: StaffRole): Promise<void> => {
  if (!(await isTeacherAiByokEnabled(env, owner, role))) {
    throw new AiCredentialServiceError('AI_BYOK_DISABLED');
  }
};

const mapRepositoryError = (error: unknown): never => {
  if (error instanceof AiCredentialRepositoryError) {
    throw new AiCredentialServiceError(error.code);
  }
  throw error;
};

export async function saveAiCredential(
  env: Env,
  input: {
    owner: string;
    role: StaffRole;
    provider: PersonalAiProvider;
    apiKey: string;
    expectedVersion: number;
    requestId: string;
    signal?: AbortSignal;
  },
): Promise<AiCredentialSummary> {
  await assertEnabled(env, input.owner, input.role);
  const existing = await getStoredCredential(env.DB, input.owner, input.provider);
  const currentVersion = existing?.version ?? 0;
  if (currentVersion !== input.expectedVersion) {
    throw new AiCredentialServiceError('AI_KEY_VERSION_CONFLICT');
  }
  if (!env.AI_CREDENTIAL_KEYRING) {
    throw new AiCredentialServiceError('AI_VAULT_UNAVAILABLE');
  }

  try {
    await testProviderCredential(input.provider, input.apiKey, input.signal);
  } catch (error) {
    if (error instanceof AiCredentialProviderError) {
      await audit(env, {
        owner: input.owner,
        role: input.role,
        eventType: 'AI_KEY_TESTED',
        provider: input.provider,
        operation: 'test',
        resultCode: error.code,
        requestId: input.requestId,
      });
    }
    throw error;
  }

  const cipher = await encryptCredential(
    env.AI_CREDENTIAL_KEYRING,
    input.owner,
    input.provider,
    input.apiKey,
  );
  try {
    const summary = await saveCredential(
      env.DB,
      input.owner,
      input.provider,
      cipher,
      input.apiKey.slice(-4),
      input.expectedVersion,
      new Date(),
      createAuditRecord({
        owner: input.owner,
        role: input.role,
        eventType: 'AI_KEY_SAVED',
        provider: input.provider,
        operation: 'save',
        resultCode: 'OK',
        requestId: input.requestId,
      }),
    );
    return summary;
  } catch (error) {
    return mapRepositoryError(error);
  }
}

export async function testStoredAiCredential(
  env: Env,
  input: {
    owner: string;
    role: StaffRole;
    provider: PersonalAiProvider;
    requestId: string;
    signal?: AbortSignal;
  },
): Promise<AiCredentialSummary> {
  await assertEnabled(env, input.owner, input.role);
  const stored = await getStoredCredential(env.DB, input.owner, input.provider);
  if (!stored) throw new AiCredentialServiceError('AI_KEY_MISSING');
  if (!env.AI_CREDENTIAL_KEYRING) {
    throw new AiCredentialServiceError('AI_VAULT_UNAVAILABLE');
  }

  const apiKey = await decryptCredential(
    env.AI_CREDENTIAL_KEYRING,
    input.owner,
    input.provider,
    stored.cipher,
  );
  try {
    await testProviderCredential(input.provider, apiKey, input.signal);
    return await markCredentialVerified(
      env.DB,
      input.owner,
      input.provider,
      stored.version,
      new Date(),
      createAuditRecord({
        owner: input.owner,
        role: input.role,
        eventType: 'AI_KEY_TESTED',
        provider: input.provider,
        operation: 'test',
        resultCode: 'OK',
        requestId: input.requestId,
      }),
    );
  } catch (error) {
    if (error instanceof AiCredentialProviderError) {
      await audit(env, {
        owner: input.owner,
        role: input.role,
        eventType: 'AI_KEY_TESTED',
        provider: input.provider,
        operation: 'test',
        resultCode: error.code,
        requestId: input.requestId,
      });
    }
    throw error;
  }
}

export async function deleteAiCredential(
  env: Env,
  input: {
    owner: string;
    role: StaffRole;
    provider: PersonalAiProvider;
    expectedVersion: number;
    requestId: string;
  },
): Promise<boolean> {
  const existing = await getStoredCredential(env.DB, input.owner, input.provider);
  if (!existing) return false;
  if (existing.version !== input.expectedVersion) {
    throw new AiCredentialServiceError('AI_KEY_VERSION_CONFLICT');
  }
  const deleted = await deleteCredential(
    env.DB,
    input.owner,
    input.provider,
    input.expectedVersion,
    createAuditRecord({
      owner: input.owner,
      role: input.role,
      eventType: 'AI_KEY_DELETED',
      provider: input.provider,
      operation: 'delete',
      resultCode: 'OK',
      requestId: input.requestId,
    }),
  );
  if (!deleted) throw new AiCredentialServiceError('AI_KEY_VERSION_CONFLICT');
  return true;
}


const providerForSource = (source: QuizAiSource): PersonalAiProvider | null => {
  if (source === 'gemini-personal') return 'gemini';
  if (source === 'deepseek-personal') return 'deepseek';
  return null;
};

export async function setAiDefaultSource(
  env: Env,
  input: {
    owner: string;
    role: StaffRole;
    source: QuizAiSource;
  },
): Promise<QuizAiSource> {
  if (input.source !== 'system') {
    await assertEnabled(env, input.owner, input.role);
    const provider = providerForSource(input.source);
    if (!provider || !(await getStoredCredential(env.DB, input.owner, provider))) {
      throw new AiCredentialServiceError('AI_KEY_MISSING');
    }
  }
  try {
    return await saveAiDefaultSource(env.DB, input.owner, input.source);
  } catch (error) {
    return mapRepositoryError(error);
  }
}

export async function resolvePersonalAiCredential(
  env: Env,
  input: {
    owner: string;
    role: StaffRole;
    source: QuizAiSource;
  },
): Promise<{
  provider: PersonalAiProvider;
  apiKey: string;
  version: number;
  model: string;
}> {
  const provider = providerForSource(input.source);
  if (!provider) throw new AiCredentialServiceError('AI_BYOK_DISABLED');
  await assertEnabled(env, input.owner, input.role);
  const stored = await getStoredCredential(env.DB, input.owner, provider);
  if (!stored) throw new AiCredentialServiceError('AI_KEY_MISSING');
  if (!env.AI_CREDENTIAL_KEYRING) {
    throw new AiCredentialServiceError('AI_VAULT_UNAVAILABLE');
  }
  let apiKey: string;
  try {
    apiKey = await decryptCredential(
      env.AI_CREDENTIAL_KEYRING,
      input.owner,
      provider,
      stored.cipher,
    );
  } catch {
    throw new AiCredentialServiceError('AI_VAULT_UNAVAILABLE');
  }
  return {
    provider,
    apiKey,
    version: stored.version,
    model: PERSONAL_AI_PROVIDER_MODELS[provider],
  };
}
