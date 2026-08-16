import { afterEach, describe, expect, it, vi } from 'vitest';
import writeExcelFile from 'write-excel-file/universal';

const mocks = vi.hoisted(() => ({
    saveAs: vi.fn(),
}));

vi.mock('file-saver', () => ({
    saveAs: mocks.saveAs,
}));

import {
    downloadStudentTemplate,
    parseStudentExcel,
} from '../src/features/class-management/utils/excelParser';

describe('excelParser', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('creates the student template with the dedicated XLSX writer', async () => {
        await downloadStudentTemplate();

        expect(mocks.saveAs).toHaveBeenCalledOnce();
        const [blob, filename] = mocks.saveAs.mock.calls[0];
        expect(filename).toBe('Mau_Them_Hoc_Sinh.xlsx');
        expect(blob).toBeInstanceOf(Blob);
        expect(blob.size).toBeGreaterThan(0);
    });

    it('generates missing usernames and passwords without Math.random', async () => {
        const mathRandom = vi.spyOn(Math, 'random').mockImplementation(() => {
            throw new Error('Math.random must not be used for credentials');
        });
        vi.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation((array: any) => {
            array.fill(0);
            return array;
        });
        const blob = await writeExcelFile([
            ['Họ và tên', 'Tên đăng nhập', 'Mật khẩu', 'SĐT'],
            ['Nguyễn Văn A', '', '', ''],
        ]).toBlob();
        const file = new File([blob], 'students.xlsx', {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });

        await expect(parseStudentExcel(file, 'class-1')).resolves.toEqual([
            expect.objectContaining({ username: 'a.nv.1002', password: 'aaaaaa' }),
        ]);
        expect(mathRandom).not.toHaveBeenCalled();
    });

    it('reads an xlsx file with the dedicated XLSX reader', async () => {
        const blob = await writeExcelFile([
            ['Họ và tên', 'Tên đăng nhập', 'Mật khẩu', 'SĐT'],
            ['Nguyễn Văn A', 'nguyenvana', 'abc123', '0987654321'],
        ]).toBlob();
        const file = new File([blob], 'students.xlsx', {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });

        await expect(parseStudentExcel(file, 'class-1')).resolves.toEqual([
            {
                fullName: 'Nguyễn Văn A',
                username: 'nguyenvana',
                password: 'abc123',
                classId: 'class-1',
                parentPhone: '0987654321',
            },
        ]);
    });
});
