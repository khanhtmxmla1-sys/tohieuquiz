import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../src/services/api/errors';

const mocks = vi.hoisted(() => ({
  callApi: vi.fn(), supports: vi.fn(), register: vi.fn(), authenticate: vi.fn(),
}));
vi.mock('../src/services/apiAdapter', () => ({ callApi: mocks.callApi }));
vi.mock('@simplewebauthn/browser', () => ({
  browserSupportsWebAuthn: mocks.supports,
  startRegistration: mocks.register,
  startAuthentication: mocks.authenticate,
}));

import {
  authenticateTeacherWithPasskey,
  registerAccountPasskey,
  revokeAccountPasskey,
} from '../src/services/passkeyService';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.supports.mockReturnValue(true);
});

describe('passkey browser service', () => {
  it('registers through options, browser ceremony, and server verification in order', async () => {
    const options = { challenge: 'registration-challenge' } as any;
    const credential = { id: 'credential-1' } as any;
    mocks.callApi
      .mockResolvedValueOnce({ data: { challengeId: 'challenge-id', options } })
      .mockResolvedValueOnce({ data: { id: 'credential-1', label: 'Laptop' } });
    mocks.register.mockResolvedValue(credential);

    await expect(registerAccountPasskey('Laptop')).resolves.toMatchObject({ id: 'credential-1' });
    expect(mocks.register).toHaveBeenCalledWith({ optionsJSON: options });
    expect(mocks.callApi).toHaveBeenNthCalledWith(2, 'finish_passkey_registration', {
      challengeId: 'challenge-id', response: credential, label: 'Laptop',
    });
  });

  it('authenticates a teacher without sending a password', async () => {
    const options = { challenge: 'authentication-challenge' } as any;
    const credential = { id: 'credential-1' } as any;
    mocks.callApi
      .mockResolvedValueOnce({ data: { challengeId: 'challenge-id', options } })
      .mockResolvedValueOnce({ data: { username: 'teacher-a', role: 'teacher' } });
    mocks.authenticate.mockResolvedValue(credential);

    await expect(authenticateTeacherWithPasskey<any>(' teacher-a ')).resolves.toMatchObject({ username: 'teacher-a' });
    expect(mocks.callApi).toHaveBeenNthCalledWith(1, 'begin_passkey_authentication', { username: 'teacher-a' });
    expect(mocks.callApi).toHaveBeenNthCalledWith(2, 'finish_passkey_authentication', {
      username: 'teacher-a', challengeId: 'challenge-id', response: credential,
    });
    expect(JSON.stringify(mocks.callApi.mock.calls)).not.toMatch(/password/i);
  });

  it('maps a public passkey 401 to a passkey-specific message without exposing account state', async () => {
    mocks.callApi.mockRejectedValueOnce(new ApiError('Phiên đăng nhập đã hết hạn.', 401));

    await expect(authenticateTeacherWithPasskey('teacher-a')).rejects.toThrow(
      'Không thể xác minh passkey. Hãy kiểm tra tài khoản đã đăng ký passkey hoặc đăng nhập bằng mật khẩu.',
    );
    expect(mocks.authenticate).not.toHaveBeenCalled();
  });

  it('fails locally when WebAuthn is unsupported and revokes by opaque credential ID', async () => {
    mocks.supports.mockReturnValue(false);
    await expect(registerAccountPasskey('Laptop')).rejects.toThrow(/passkey/i);
    expect(mocks.callApi).not.toHaveBeenCalled();
    mocks.callApi.mockResolvedValueOnce({ status: 'success' });
    await revokeAccountPasskey('opaque-id');
    expect(mocks.callApi).toHaveBeenCalledWith('revoke_account_passkey', { credentialId: 'opaque-id' });
  });
});
