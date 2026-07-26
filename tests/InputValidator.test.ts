import { describe, it, expect } from 'vitest';
import { InputValidator } from '../utils/InputValidator';

describe('InputValidator', () => {
    describe('validateStudentName', () => {
        it('should validate correct Vietnamese names', () => {
            expect(InputValidator.validateStudentName('Nguyen Van A').valid).toBe(true);
            expect(InputValidator.validateStudentName('Lò Văn An').valid).toBe(true);
            expect(InputValidator.validateStudentName('Trần Thị Bích').valid).toBe(true);
        });

        it('should reject empty names', () => {
            const result = InputValidator.validateStudentName('');
            expect(result.valid).toBe(false);
            expect(result.error).toBeDefined();
        });

        it('should reject names too short', () => {
            const result = InputValidator.validateStudentName('A');
            expect(result.valid).toBe(false);
        });

        it('should reject names with numbers', () => {
            const result = InputValidator.validateStudentName('Nguyen Van 123');
            expect(result.valid).toBe(false);
        });
    });

    describe('validateClassName', () => {
        it('should validate correct class names', () => {
            expect(InputValidator.validateClassName('3A1').valid).toBe(true);
            expect(InputValidator.validateClassName('5A9').valid).toBe(true);
            expect(InputValidator.validateClassName('1A').valid).toBe(true); // Without number
        });

        it('should reject invalid class names', () => {
            expect(InputValidator.validateClassName('6A1').valid).toBe(false); // Class 6 invalid
            expect(InputValidator.validateClassName('').valid).toBe(false);
            expect(InputValidator.validateClassName('ABC').valid).toBe(false);
        });
    });

    describe('validateUsername', () => {
        it('should validate correct usernames', () => {
            expect(InputValidator.validateUsername('admin').valid).toBe(true);
            expect(InputValidator.validateUsername('teacher_01').valid).toBe(true);
        });

        it('should reject short usernames', () => {
            expect(InputValidator.validateUsername('ab').valid).toBe(false);
        });
    });

    describe('validatePassword', () => {
        it('should validate correct passwords', () => {
            expect(InputValidator.validatePassword('admin').valid).toBe(true);
            expect(InputValidator.validatePassword('password123').valid).toBe(true);
        });

        it('should reject short passwords', () => {
            expect(InputValidator.validatePassword('123').valid).toBe(false);
        });
    });

    describe('validateAccessCode', () => {
        it('should validate 6-character codes', () => {
            expect(InputValidator.validateAccessCode('ABC123').valid).toBe(true);
            expect(InputValidator.validateAccessCode('XXXXXX').valid).toBe(true);
        });

        it('should accept lowercase (auto-uppercased)', () => {
            // Implementation converts to uppercase before validation
            expect(InputValidator.validateAccessCode('abc123').valid).toBe(true);
        });

        it('should reject wrong length codes', () => {
            expect(InputValidator.validateAccessCode('ABC12').valid).toBe(false);
            expect(InputValidator.validateAccessCode('ABC12345').valid).toBe(false);
        });
    });

    describe('sanitizeHTML', () => {
        it('should escape HTML special characters', () => {
            const input = '<script>alert("xss")</script>';
            const result = InputValidator.sanitizeHTML(input);
            expect(result).toContain('&lt;');
            expect(result).toContain('&gt;');
        });
    });

    describe('sanitizeInput', () => {
        it('should remove angle brackets', () => {
            const result = InputValidator.sanitizeInput('<Hello>');
            expect(result).toBe('Hello');
        });

        it('should remove event handlers', () => {
            const result = InputValidator.sanitizeInput('onclick=alert()');
            expect(result).not.toContain('onclick=');
        });
    });
});
