import type { Env } from '../types';

export interface ParentEmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
  idempotencyKey: string;
}

export interface ParentEmailSendResult {
  messageId: string;
}

export interface ParentEmailProvider {
  readonly ready: boolean;
  readonly reason: string | null;
  send(message: ParentEmailMessage): Promise<ParentEmailSendResult>;
}

const enabled = (value: unknown): boolean => String(value || '').toLowerCase() === 'true';

export const isParentEmailRolloutReady = (env: Env): boolean => (
  env.PARENT_EMAIL_PROVIDER === 'http'
  && Boolean(env.PARENT_EMAIL_API_URL)
  && Boolean(env.PARENT_EMAIL_API_TOKEN)
  && Boolean(env.PARENT_EMAIL_FROM)
  && Boolean(env.PARENT_EMAIL_PUBLIC_BASE_URL)
  && enabled(env.PARENT_EMAIL_SPF_READY)
  && enabled(env.PARENT_EMAIL_DKIM_READY)
  && enabled(env.PARENT_EMAIL_DMARC_READY)
);

const unavailableProvider = (reason: string): ParentEmailProvider => ({
  ready: false,
  reason,
  async send() {
    throw new Error(`PARENT_EMAIL_ROLLOUT_NOT_READY:${reason}`);
  },
});

export function createParentEmailProvider(env: Env): ParentEmailProvider {
  if (env.PARENT_EMAIL_PROVIDER !== 'http') {
    return unavailableProvider('provider_disabled');
  }
  if (!enabled(env.PARENT_EMAIL_SPF_READY)
    || !enabled(env.PARENT_EMAIL_DKIM_READY)
    || !enabled(env.PARENT_EMAIL_DMARC_READY)) {
    return unavailableProvider('domain_authentication_incomplete');
  }
  if (!env.PARENT_EMAIL_API_URL || !env.PARENT_EMAIL_API_TOKEN || !env.PARENT_EMAIL_FROM) {
    return unavailableProvider('provider_configuration_incomplete');
  }

  let endpoint: URL;
  try {
    endpoint = new URL(env.PARENT_EMAIL_API_URL);
    if (endpoint.protocol !== 'https:') return unavailableProvider('provider_url_must_use_https');
  } catch {
    return unavailableProvider('provider_url_invalid');
  }

  return {
    ready: true,
    reason: null,
    async send(message) {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.PARENT_EMAIL_API_TOKEN}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': message.idempotencyKey,
        },
        body: JSON.stringify({
          from: env.PARENT_EMAIL_FROM,
          to: message.to,
          subject: message.subject,
          text: message.text,
          ...(message.html ? { html: message.html } : {}),
        }),
      });
      if (!response.ok) {
        throw new Error(`PARENT_EMAIL_PROVIDER_FAILED:${response.status}`);
      }
      let payload: Record<string, unknown> = {};
      try {
        payload = await response.json<Record<string, unknown>>();
      } catch {
        // Some providers return 202 without a JSON body.
      }
      const messageId = String(payload.id || payload.messageId || response.headers.get('x-message-id') || crypto.randomUUID());
      return { messageId };
    },
  };
}
