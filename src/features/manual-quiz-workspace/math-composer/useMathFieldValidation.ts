import { useEffect, useMemo, useState } from 'react';
import {
    analyzeMathText,
    hasMathSyntax,
    type MathSyntaxIssue,
} from '../../../utils/mathText';
import {
    validateQuestionMath,
    type QuestionMathIssue,
} from '../../../utils/questionMath';

export interface TeacherMathIssue {
    code: MathSyntaxIssue['code'];
    message: string;
    suggestion: string;
    position: number;
    field?: string;
}

export interface MathFieldValidationOptions {
    delayMs?: number;
    onTelemetry?(issueCodes: string[]): void;
}

export type MathFieldValidationStatus = 'idle' | 'checking' | 'valid' | 'invalid';

export interface MathFieldValidationResult {
    status: MathFieldValidationStatus;
    issues: TeacherMathIssue[];
}

const TEACHER_MESSAGES: Record<MathSyntaxIssue['code'], { message: string; suggestion: string }> = {
    'unclosed-delimiter': {
        message: 'Công thức đang thiếu dấu đóng.',
        suggestion: 'Thêm dấu $ ở cuối công thức hoặc dùng lại nút chèn công thức.',
    },
    'unexpected-delimiter': {
        message: 'Có dấu đóng công thức nhưng chưa có dấu mở.',
        suggestion: 'Xóa dấu đóng thừa hoặc thêm dấu mở tương ứng trước công thức.',
    },
    'unbalanced-braces': {
        message: 'Các dấu ngoặc nhọn trong công thức chưa cân bằng.',
        suggestion: 'Kiểm tra mỗi dấu { đều có một dấu } tương ứng.',
    },
    'malformed-command': {
        message: 'Công thức đang thiếu một phần bắt buộc.',
        suggestion: 'Mở bảng Công thức toán và nhập lại các ô còn thiếu.',
    },
    'unsupported-command': {
        message: 'Công thức có ký hiệu chưa được hỗ trợ.',
        suggestion: 'Dùng ký hiệu có sẵn trong bảng Công thức toán hoặc chọn tùy chọn gần nhất.',
    },
};

export const getTeacherMathIssueMessage = (
    issue: MathSyntaxIssue | QuestionMathIssue,
): TeacherMathIssue => ({
    code: issue.code,
    message: TEACHER_MESSAGES[issue.code].message,
    suggestion: TEACHER_MESSAGES[issue.code].suggestion,
    position: Math.max(1, issue.index + 1),
    field: 'field' in issue ? issue.field : undefined,
});

const analyzeValue = (value: unknown): TeacherMathIssue[] => {
    if (typeof value === 'string') {
        if (!hasMathSyntax(value)) return [];
        return analyzeMathText(value).map(getTeacherMathIssueMessage);
    }
    return validateQuestionMath(value).map(getTeacherMathIssueMessage);
};

const containsMath = (value: unknown): boolean => {
    if (typeof value === 'string') return hasMathSyntax(value);
    try {
        return hasMathSyntax(JSON.stringify(value));
    } catch {
        return false;
    }
};

export const useMathFieldValidation = (
    value: unknown,
    options: MathFieldValidationOptions = {},
): MathFieldValidationResult => {
    const { delayMs = 150, onTelemetry } = options;
    const serializedValue = useMemo(() => {
        try {
            return typeof value === 'string' ? value : JSON.stringify(value);
        } catch {
            return '';
        }
    }, [value]);
    const [result, setResult] = useState<MathFieldValidationResult>({
        status: containsMath(value) ? 'checking' : 'idle',
        issues: [],
    });

    useEffect(() => {
        if (!containsMath(value)) {
            setResult({ status: 'idle', issues: [] });
            return undefined;
        }

        setResult((current) => ({ ...current, status: 'checking' }));
        const timer = window.setTimeout(() => {
            const issues = analyzeValue(value);
            setResult({
                status: issues.length > 0 ? 'invalid' : 'valid',
                issues,
            });
            if (issues.length > 0) {
                onTelemetry?.([...new Set(issues.map((issue) => issue.code))]);
            }
        }, delayMs);

        return () => window.clearTimeout(timer);
    }, [delayMs, onTelemetry, serializedValue, value]);

    return result;
};
