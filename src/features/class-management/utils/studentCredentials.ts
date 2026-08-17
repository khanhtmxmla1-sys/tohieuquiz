const PASSWORD_ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
const UINT32_RANGE = 0x1_0000_0000;

const secureRandomIndex = (maxExclusive: number): number => {
    if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
        throw new Error('maxExclusive must be a positive integer.');
    }

    const limit = Math.floor(UINT32_RANGE / maxExclusive) * maxExclusive;
    const random = new Uint32Array(1);
    do {
        globalThis.crypto.getRandomValues(random);
    } while (random[0] >= limit);

    return random[0] % maxExclusive;
};

export const generateTemporaryStudentPassword = (length = 6): string => {
    if (!Number.isInteger(length) || length < 6 || length > 64) {
        throw new Error('Temporary password length must be between 6 and 64 characters.');
    }

    let password = '';
    for (let index = 0; index < length; index += 1) {
        password += PASSWORD_ALPHABET[secureRandomIndex(PASSWORD_ALPHABET.length)];
    }
    return password;
};

export const generateStudentUsernameSuffix = (): number => 100 + secureRandomIndex(900);
