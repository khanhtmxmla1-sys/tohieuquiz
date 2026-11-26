import { z } from 'zod';

export const quizAccessCodeSchema = z.object({
    accessCode: z.string().trim().min(1).max(10).regex(/^[A-Za-z0-9]+$/),
    assignmentId: z.string().trim().min(1).max(128).optional(),
});

export const isEnabledFlag = (value: unknown): boolean => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    return ['1', 'true', 'yes', 'on', 'enabled'].includes(String(value ?? '').trim().toLowerCase());
};

export const constantTimeTextEqual = (actual: string, expected: string): boolean => {
    const encoder = new TextEncoder();
    const actualBytes = encoder.encode(actual);
    const expectedBytes = encoder.encode(expected);
    const maxLength = Math.max(actualBytes.length, expectedBytes.length);
    let difference = actualBytes.length ^ expectedBytes.length;
    for (let index = 0; index < maxLength; index += 1) {
        difference |= (actualBytes[index] ?? 0) ^ (expectedBytes[index] ?? 0);
    }
    return difference === 0;
};
