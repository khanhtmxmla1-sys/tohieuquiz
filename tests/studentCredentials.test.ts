import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  generateStudentUsernameSuffix,
  generateTemporaryStudentPassword,
} from '../src/features/class-management/utils/studentCredentials';

describe('student credential generation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses Web Crypto instead of Math.random for temporary passwords', () => {
    const mathRandom = vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random must not be used for credentials');
    });
    const cryptoRandom = vi.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation((array: any) => {
      array.fill(0);
      return array;
    });

    const password = generateTemporaryStudentPassword(8);

    expect(password).toHaveLength(8);
    expect(password).toMatch(/^[A-Za-z0-9]+$/);
    expect(cryptoRandom).toHaveBeenCalled();
    expect(mathRandom).not.toHaveBeenCalled();
  });

  it('uses Web Crypto for the three-digit username suffix', () => {
    const mathRandom = vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random must not be used for credentials');
    });
    vi.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation((array: any) => {
      array.fill(0);
      return array;
    });

    expect(generateStudentUsernameSuffix()).toBe(100);
    expect(mathRandom).not.toHaveBeenCalled();
  });
});
