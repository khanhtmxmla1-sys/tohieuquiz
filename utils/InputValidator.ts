/**
 * Input Validation Utilities
 * Provides validation and sanitization for user inputs
 */

export interface ValidationResult {
    valid: boolean;
    error?: string;
}

/**
 * InputValidator class for validating and sanitizing user inputs
 */
export class InputValidator {
    /**
     * Validate student name
     * - Min 2 characters, max 50 characters
     * - Only letters, spaces, and Vietnamese characters allowed
     */
    static validateStudentName(name: string): ValidationResult {
        const trimmed = name.trim();

        if (!trimmed) {
            return { valid: false, error: 'Vui lòng nhập họ tên' };
        }

        if (trimmed.length < 2) {
            return { valid: false, error: 'Họ tên phải có ít nhất 2 ký tự' };
        }

        if (trimmed.length > 50) {
            return { valid: false, error: 'Họ tên không được quá 50 ký tự' };
        }

        // Allow letters (including Vietnamese), spaces, and basic punctuation
        const validNamePattern = /^[a-zA-ZÀ-ỹ\s\-'.]+$/;
        if (!validNamePattern.test(trimmed)) {
            return { valid: false, error: 'Họ tên chứa ký tự không hợp lệ' };
        }

        return { valid: true };
    }

    /**
     * Validate class name
     * - Format: number + letter + optional number (e.g., 3A1, 4B2)
     */
    static validateClassName(className: string): ValidationResult {
        const trimmed = className.trim();

        if (!trimmed) {
            return { valid: false, error: 'Vui lòng chọn lớp' };
        }

        // Pattern: 1-5 followed by A-Z and optional number
        const validClassPattern = /^[1-5][A-Za-z][0-9]?$/;
        if (!validClassPattern.test(trimmed)) {
            return { valid: false, error: 'Tên lớp không hợp lệ (ví dụ: 3A1, 4B)' };
        }

        return { valid: true };
    }

    /**
     * Validate teacher username
     * - Min 3 characters, max 30 characters
     * - Only alphanumeric and underscore
     */
    static validateUsername(username: string): ValidationResult {
        const trimmed = username.trim();

        if (!trimmed) {
            return { valid: false, error: 'Vui lòng nhập tên đăng nhập' };
        }

        if (trimmed.length < 3) {
            return { valid: false, error: 'Tên đăng nhập phải có ít nhất 3 ký tự' };
        }

        if (trimmed.length > 30) {
            return { valid: false, error: 'Tên đăng nhập không được quá 30 ký tự' };
        }

        const validUsernamePattern = /^[a-zA-Z0-9_]+$/;
        if (!validUsernamePattern.test(trimmed)) {
            return { valid: false, error: 'Tên đăng nhập chỉ được chứa chữ, số và dấu gạch dưới' };
        }

        return { valid: true };
    }

    /**
     * Validate password
     * - Min 4 characters
     */
    static validatePassword(password: string): ValidationResult {
        if (!password) {
            return { valid: false, error: 'Vui lòng nhập mật khẩu' };
        }

        if (password.length < 4) {
            return { valid: false, error: 'Mật khẩu phải có ít nhất 4 ký tự' };
        }

        return { valid: true };
    }

    /**
     * Validate quiz title
     * - Min 5 characters, max 200 characters
     */
    static validateQuizTitle(title: string): ValidationResult {
        const trimmed = title.trim();

        if (!trimmed) {
            return { valid: false, error: 'Vui lòng nhập tiêu đề bài kiểm tra' };
        }

        if (trimmed.length < 5) {
            return { valid: false, error: 'Tiêu đề phải có ít nhất 5 ký tự' };
        }

        if (trimmed.length > 200) {
            return { valid: false, error: 'Tiêu đề không được quá 200 ký tự' };
        }

        return { valid: true };
    }

    /**
     * Validate access code
     * - Must be exactly 6 alphanumeric characters
     */
    static validateAccessCode(code: string): ValidationResult {
        const trimmed = code.trim().toUpperCase();

        if (!trimmed) {
            return { valid: false, error: 'Vui lòng nhập mã truy cập' };
        }

        if (trimmed.length !== 6) {
            return { valid: false, error: 'Mã truy cập phải có đúng 6 ký tự' };
        }

        const validCodePattern = /^[A-Z0-9]+$/;
        if (!validCodePattern.test(trimmed)) {
            return { valid: false, error: 'Mã truy cập chỉ được chứa chữ và số' };
        }

        return { valid: true };
    }

    /**
     * Validate email (optional validation)
     */
    static validateEmail(email: string): ValidationResult {
        const trimmed = email.trim();

        if (!trimmed) {
            return { valid: true }; // Email is optional
        }

        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailPattern.test(trimmed)) {
            return { valid: false, error: 'Email không hợp lệ' };
        }

        return { valid: true };
    }

    /**
     * Sanitize HTML to prevent XSS attacks
     * Escapes HTML special characters
     */
    static sanitizeHTML(input: string): string {
        if (!input) return '';

        const div = document.createElement('div');
        div.textContent = input;
        return div.innerHTML;
    }

    /**
     * Sanitize input by removing potentially dangerous characters
     */
    static sanitizeInput(input: string): string {
        if (!input) return '';

        return input
            .replace(/[<>]/g, '') // Remove angle brackets
            .replace(/javascript:/gi, '') // Remove javascript protocol
            .replace(/on\w+=/gi, '') // Remove event handlers
            .trim();
    }

    /**
     * Normalize Vietnamese text (remove diacritics for search)
     */
    static normalizeVietnamese(text: string): string {
        if (!text) return '';

        return text
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim();
    }
}

export default InputValidator;
