import {
  browserSupportsWebAuthn,
  startAuthentication,
  startRegistration,
} from '@simplewebauthn/browser';
import { callApi } from './apiAdapter';

export interface AccountPasskey {
  id: string;
  label: string;
  deviceType: string;
  backedUp: boolean;
  createdAt: string;
  lastUsedAt: string | null;
}

interface RegistrationOptionsResponse {
  challengeId: string;
  options: Parameters<typeof startRegistration>[0]['optionsJSON'];
}

interface AuthenticationOptionsResponse {
  challengeId: string;
  options: Parameters<typeof startAuthentication>[0]['optionsJSON'];
}

export const passkeysSupported = (): boolean => (
  typeof window !== 'undefined' && browserSupportsWebAuthn()
);

export const getAccountPasskeys = async (): Promise<AccountPasskey[]> => {
  const response = await callApi<{ status: string; data: AccountPasskey[] }>('get_account_passkeys');
  return response.data || [];
};

export const registerAccountPasskey = async (label: string): Promise<AccountPasskey> => {
  if (!passkeysSupported()) throw new Error('Trình duyệt hoặc thiết bị này chưa hỗ trợ passkey.');
  const begin = await callApi<{ status: string; data: RegistrationOptionsResponse }>('begin_passkey_registration');
  const credential = await startRegistration({ optionsJSON: begin.data.options });
  const finish = await callApi<{ status: string; data: AccountPasskey }>('finish_passkey_registration', {
    challengeId: begin.data.challengeId,
    response: credential,
    label,
  });
  return finish.data;
};

export const revokeAccountPasskey = async (credentialId: string): Promise<void> => {
  await callApi('revoke_account_passkey', { credentialId });
};

export const authenticateTeacherWithPasskey = async <T = unknown>(username: string): Promise<T> => {
  const normalized = username.trim();
  if (!normalized) throw new Error('Hãy nhập tài khoản giáo viên trước.');
  if (!passkeysSupported()) throw new Error('Trình duyệt hoặc thiết bị này chưa hỗ trợ passkey.');
  const begin = await callApi<{ status: string; data: AuthenticationOptionsResponse }>('begin_passkey_authentication', {
    username: normalized,
  });
  const credential = await startAuthentication({ optionsJSON: begin.data.options });
  const finish = await callApi<{ status: string; data: T }>('finish_passkey_authentication', {
    username: normalized,
    challengeId: begin.data.challengeId,
    response: credential,
  });
  return finish.data;
};
