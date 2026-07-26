import { describe, expect, it } from 'vitest';
import { areClassNamesEqual, normalizeClassName } from '../src/utils/classMatching';

describe('classMatching', () => {
    it('normalizes common class labels and separators', () => {
        expect(normalizeClassName(' Lớp 3-A ')).toBe('3a');
        expect(normalizeClassName('class 3_A')).toBe('3a');
    });

    it('matches the same class without using partial matching', () => {
        expect(areClassNamesEqual('3A', ' lớp 3-a ')).toBe(true);
        expect(areClassNamesEqual('3A', '13A')).toBe(false);
        expect(areClassNamesEqual('13A', '3A')).toBe(false);
    });

    it('does not treat missing class values as a match', () => {
        expect(areClassNamesEqual('', '')).toBe(false);
        expect(areClassNamesEqual(null, '3A')).toBe(false);
    });
});
