export const PERSONAL_AI_PROVIDERS = ['gemini', 'deepseek'] as const;
export type PersonalAiProvider = typeof PERSONAL_AI_PROVIDERS[number];

export const QUIZ_AI_SOURCES = ['system', 'gemini-personal', 'deepseek-personal'] as const;
export type QuizAiSource = typeof QUIZ_AI_SOURCES[number];

export interface AiCredentialSummary {
  provider: PersonalAiProvider;
  configured: boolean;
  last4: string | null;
  version: number;
  verifiedAt: string | null;
  updatedAt: string | null;
}

export interface SaveAiCredentialInput {
  apiKey: string;
  expectedVersion: number;
}

export interface SaveAiPreferenceInput {
  defaultSource: QuizAiSource;
}

export interface AiCredentialCipher {
  formatVersion: 1;
  keyId: string;
  iv: string;
  ciphertext: string;
}
