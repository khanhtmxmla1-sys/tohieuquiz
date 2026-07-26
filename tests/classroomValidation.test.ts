import { describe, expect, it } from 'vitest';
import { normalizeStudentInput, validateStudentInput } from '../workers/src/routes/classroom';

describe('classroom student validation', () => {
    it('normalizes names and usernames before persistence', () => {
        expect(normalizeStudentInput({
            fullName: '  Hoc   Sinh Mau  ',
            username: '  AN.NVA_01 ',
            password: ' abc123 ',
            classId: ' c1 ',
            parentPhone: ' 0987 654 321 ',
        })).toEqual({
            fullName: 'Hoc Sinh Mau',
            username: 'an.nva_01',
            password: 'abc123',
            classId: 'c1',
            parentPhone: '0987 654 321',
        });
    });

    it('accepts a valid student', () => {
        expect(validateStudentInput(normalizeStudentInput({ fullName: 'Hoc Sinh Mau', username: 'an.nv.101', password: 'abc123', classId: 'c1' }))).toBeNull();
    });

    it.each([
        [{ fullName: 'A', username: 'an.nv', password: 'abc123', classId: 'c1' }, 'Họ tên'],
        [{ fullName: 'Hoc Sinh Mau', username: 'An Nguyễn', password: 'abc123', classId: 'c1' }, 'Tên đăng nhập'],
        [{ fullName: 'Hoc Sinh Mau', username: 'an.nv', password: '123', classId: 'c1' }, 'Mật khẩu'],
        [{ fullName: 'Hoc Sinh Mau', username: 'an.nv', password: 'abc123', classId: '' }, 'Thiếu lớp'],
        [{ fullName: 'Hoc Sinh Mau', username: 'an.nv', password: 'abc123', classId: 'c1', parentPhone: 'abc' }, 'Số điện thoại'],
    ])('rejects invalid input %#', (input, expectedMessage) => {
        expect(validateStudentInput(normalizeStudentInput(input))).toContain(expectedMessage);
    });
});
