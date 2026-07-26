export const normalizeStudentInput = (raw: any) => ({
    fullName: String(raw?.fullName || '').trim().replace(/\s+/g, ' '),
    username: String(raw?.username || '').trim().toLowerCase(),
    password: String(raw?.password || '').trim(),
    classId: String(raw?.classId || '').trim(),
    parentPhone: String(raw?.parentPhone || '').trim(),
});

export const validateStudentInput = (
    student: ReturnType<typeof normalizeStudentInput>
): string | null => {
    if (student.fullName.length < 2 || student.fullName.length > 100) {
        return 'Họ tên phải từ 2 đến 100 ký tự';
    }
    if (!/^[a-z0-9._-]{3,40}$/.test(student.username)) {
        return 'Tên đăng nhập chỉ gồm chữ thường, số, dấu chấm, gạch dưới hoặc gạch ngang (3-40 ký tự)';
    }
    if (student.password.length < 6 || student.password.length > 64) {
        return 'Mật khẩu phải từ 6 đến 64 ký tự';
    }
    if (!student.classId) return 'Thiếu lớp học';
    if (student.parentPhone && !/^[0-9+().\s-]{8,20}$/.test(student.parentPhone)) {
        return 'Số điện thoại phụ huynh không hợp lệ';
    }
    return null;
};
