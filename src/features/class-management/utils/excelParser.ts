import type { SheetData } from 'write-excel-file/browser';
import type { CreateStudentPayload } from '../types';

export interface StudentCredential {
    fullName: string;
    username: string;
    password: string;
}

const cellText = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    if (value instanceof Date) return value.toISOString();
    return String(value).trim();
};

const createWorkbookBlob = async (
    data: SheetData,
    sheet: string,
    columns: { width?: number }[],
    stickyRowsCount = 0,
): Promise<Blob> => {
    const { default: writeExcelFile } = await import('write-excel-file/browser');
    return writeExcelFile(data, { sheet, columns, stickyRowsCount }).toBlob();
};

const readFileArrayBuffer = (file: File): Promise<ArrayBuffer> => {
    if (typeof file.arrayBuffer === 'function') return file.arrayBuffer();
    return new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error || new Error('Không đọc được nội dung file.'));
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.readAsArrayBuffer(file);
    });
};

// --- Template Download ---

export const downloadStudentTemplate = async (): Promise<void> => {
    const { saveAs } = await import('file-saver');
    const blob = await createWorkbookBlob([
        [
            { value: 'Họ và tên *', fontWeight: 'bold' },
            { value: 'Tên đăng nhập (để trống tự tạo)', fontWeight: 'bold' },
            { value: 'Mật khẩu (để trống tự tạo)', fontWeight: 'bold' },
            { value: 'SĐT phụ huynh', fontWeight: 'bold' },
        ],
        ['Nguyễn Văn A', 'a.nv.101', 'xyz123', '0987654321'],
        ['Trần Thị B', '', '', ''],
        ['Lê Minh C', '', '', ''],
    ], 'HocSinh', [
        { width: 22 },
        { width: 32 },
        { width: 27 },
        { width: 17 },
    ], 1);
    saveAs(blob, 'Mau_Them_Hoc_Sinh.xlsx');
};

export const downloadStudentCredentials = async (
    credentials: StudentCredential[],
    className = 'Lop_hoc',
): Promise<void> => {
    const { saveAs } = await import('file-saver');
    const data: SheetData = [
        [
            { value: 'Họ và tên', fontWeight: 'bold' },
            { value: 'Tên đăng nhập', fontWeight: 'bold' },
            { value: 'Mật khẩu ban đầu', fontWeight: 'bold' },
        ],
        ...credentials.map((credential) => [credential.fullName, credential.username, credential.password]),
    ];
    const blob = await createWorkbookBlob(data, 'TaiKhoanHocSinh', [
        { width: 28 },
        { width: 28 },
        { width: 22 },
    ], 1);
    saveAs(blob, `Tai_khoan_${className.replace(/[^a-zA-Z0-9_-]+/g, '_')}.xlsx`);
};

// --- Excel Parser ---

export const parseStudentExcel = async (file: File, classId: string): Promise<CreateStudentPayload[]> => {
    try {
        const { readSheet } = await import('read-excel-file/browser');
        const rows = await readSheet(await readFileArrayBuffer(file));
        if (rows.length <= 1) {
            throw new Error('File trống hoặc không có dữ liệu (cần ít nhất 1 dòng dữ liệu không tính tiêu đề).');
        }

        const students: CreateStudentPayload[] = [];
        rows.slice(1).forEach((row, index) => {
            const rowNumber = index + 2;
            const fullNameRow = cellText(row[0]);
            if (!fullNameRow) return;

            let usernameRow = cellText(row[1]);
            let passwordRow = cellText(row[2]);
            const phoneRow = cellText(row[3]);

            if (!usernameRow) {
                const parts = fullNameRow.toLowerCase().split(/\s+/);
                const firstName = parts[parts.length - 1] || '';
                const lastInitial = parts[0]?.[0] || '';
                const mid = parts.length > 2 ? parts.slice(1, -1).map((part) => part[0]).join('') : '';
                const suffix = Math.floor(Math.random() * 900 + 100);
                const clean = (value: string) => value
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '')
                    .replace(/đ/g, 'd')
                    .replace(/Đ/g, 'D');
                usernameRow = clean(`${firstName}.${lastInitial}${mid}.${suffix}${rowNumber}`);
            }
            usernameRow = usernameRow.toLowerCase().replace(/[^a-z0-9._-]/g, '');

            if (!passwordRow) {
                const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
                for (let k = 0; k < 6; k += 1) {
                    passwordRow += chars[Math.floor(Math.random() * chars.length)];
                }
            }

            students.push({
                fullName: fullNameRow,
                username: usernameRow,
                password: passwordRow,
                classId,
                parentPhone: phoneRow,
            });
        });

        if (students.length === 0) {
            throw new Error('Không tìm thấy dữ liệu học sinh hợp lệ.');
        }
        return students;
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error.';
        if (message.startsWith('File trống') || message === 'Không tìm thấy dữ liệu học sinh hợp lệ.') {
            throw error;
        }
        throw new Error(`Lỗi đọc file Excel: ${message}`);
    }
};
