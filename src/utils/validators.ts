/**
 * Validation Utilities
 * 
 * Form and data validation functions.
 * Follows Single Responsibility Principle - only handles validation.
 */

/**
 * Validates that a required string field is not empty
 */
export const isNotEmpty = (value: string): boolean => {
    return value.trim().length > 0;
};

/**
 * Validates a quiz title
 * - Must be at least 3 characters
 * - Must not exceed 200 characters
 */
export const validateQuizTitle = (title: string): { valid: boolean; error?: string } => {
    if (!isNotEmpty(title)) {
        return { valid: false, error: 'Tiêu đề không được để trống' };
    }
    if (title.length < 3) {
        return { valid: false, error: 'Tiêu đề phải có ít nhất 3 ký tự' };
    }
    if (title.length > 200) {
        return { valid: false, error: 'Tiêu đề không được vượt quá 200 ký tự' };
    }
    return { valid: true };
};

/**
 * Validates class level
 * - Must be between 1 and 5
 */
export const validateClassLevel = (level: string): { valid: boolean; error?: string } => {
    const num = parseInt(level, 10);
    if (isNaN(num) || num < 1 || num > 5) {
        return { valid: false, error: 'Cấp lớp phải từ 1 đến 5' };
    }
    return { valid: true };
};

/**
 * Validates time limit
 * - Must be between 1 and 180 minutes
 */
export const validateTimeLimit = (minutes: number): { valid: boolean; error?: string } => {
    if (minutes < 1) {
        return { valid: false, error: 'Thời gian phải ít nhất 1 phút' };
    }
    if (minutes > 180) {
        return { valid: false, error: 'Thời gian không được vượt quá 180 phút' };
    }
    return { valid: true };
};

/**
 * Validates question count
 * - Must be between 1 and 50
 */
export const validateQuestionCount = (count: number): { valid: boolean; error?: string } => {
    if (count < 1) {
        return { valid: false, error: 'Phải có ít nhất 1 câu hỏi' };
    }
    if (count > 50) {
        return { valid: false, error: 'Không được vượt quá 50 câu hỏi' };
    }
    return { valid: true };
};

/**
 * Validates access code format
 * - Must be exactly 6 alphanumeric characters
 */
export const validateAccessCode = (code: string): { valid: boolean; error?: string } => {
    const pattern = /^[A-Z0-9]{6}$/i;
    if (!pattern.test(code)) {
        return { valid: false, error: 'Mã truy cập phải gồm 6 ký tự chữ hoặc số' };
    }
    return { valid: true };
};

/**
 * Validates student name
 * - Must be at least 2 characters
 * - Must not exceed 100 characters
 */
export const validateStudentName = (name: string): { valid: boolean; error?: string } => {
    if (!isNotEmpty(name)) {
        return { valid: false, error: 'Tên học sinh không được để trống' };
    }
    if (name.length < 2) {
        return { valid: false, error: 'Tên phải có ít nhất 2 ký tự' };
    }
    if (name.length > 100) {
        return { valid: false, error: 'Tên không được vượt quá 100 ký tự' };
    }
    return { valid: true };
};

/**
 * Validates image file
 * - Must be under specified size (default 5MB)
 * - Must be an allowed type (jpeg, png, gif, webp)
 */
export const validateImageFile = (
    file: File,
    maxSizeMB: number = 5,
    allowedTypes: string[] = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
): { valid: boolean; error?: string } => {
    if (!allowedTypes.includes(file.type)) {
        return { valid: false, error: `Định dạng không hỗ trợ. Cho phép: ${allowedTypes.join(', ')}` };
    }
    if (file.size > maxSizeMB * 1024 * 1024) {
        return { valid: false, error: `File quá lớn. Tối đa ${maxSizeMB}MB` };
    }
    return { valid: true };
};

/**
 * Validates that at least one question type is selected
 */
export const validateSelectedTypes = (
    selectedTypes: Record<string, boolean>
): { valid: boolean; error?: string } => {
    const hasSelected = Object.values(selectedTypes).some(v => v === true);
    if (!hasSelected) {
        return { valid: false, error: 'Vui lòng chọn ít nhất một loại câu hỏi' };
    }
    return { valid: true };
};

/**
 * Validates difficulty percentages sum to 100
 */
export const validateDifficultySum = (
    difficulty: { easy: number; medium: number; hard: number }
): { valid: boolean; error?: string } => {
    const sum = difficulty.easy + difficulty.medium + difficulty.hard;
    if (sum !== 100) {
        return { valid: false, error: `Tổng độ khó phải bằng 100% (hiện tại: ${sum}%)` };
    }
    return { valid: true };
};
