/** Shared types and mini-components used across all editor forms. */
import React, { useCallback, useRef, useState } from 'react';
import { NewlineMathText } from '../../../../../components/common';
import { analyzeMathText, hasMathSyntax } from '../../../../../utils/mathText';
import {
    insertMathTemplate,
    type FormulaInsertionResult,
} from '../../../../manual-quiz-workspace/math-composer/mathInsertion';
import type { MathTemplateId } from '../../../../manual-quiz-workspace/math-composer/mathTemplates';
import { useMathComposerField } from '../../../../manual-quiz-workspace/math-composer/useMathComposer';

export const FieldRow: React.FC<{
    label: string;
    hint?: string;
    children: React.ReactNode;
}> = ({ label, hint, children }) => (
    <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
        {hint && <p className="text-xs text-gray-400 mb-1.5">{hint}</p>}
        {children}
    </div>
);

export const MathFieldPreview: React.FC<{ value: string; className?: string }> = ({ value, className }) => {
    if (!hasMathSyntax(value)) return null;
    const issues = analyzeMathText(value);

    return (
        <div className={`mt-1.5 rounded-lg border px-2.5 py-2 text-sm ${
            issues.length > 0
                ? 'border-red-200 bg-red-50 text-red-700'
                : 'border-blue-100 bg-blue-50/60 text-blue-900'
        } ${className || ''}`}>
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wider opacity-70">
                Xem trước công thức
            </div>
            <NewlineMathText content={value} as="span" className="quiz-text-preserve-inline" />
            {issues.length > 0 && (
                <p className="mt-1 text-xs font-semibold">
                    ⚠ {issues[0].message}
                </p>
            )}
        </div>
    );
};

export type { FormulaInsertionResult };

/** Compatibility adapter for the legacy compact toolbar. */
export const insertFormulaTemplate = (
    value: string,
    selectionStart: number,
    selectionEnd: number,
    templateId: MathTemplateId,
): FormulaInsertionResult => insertMathTemplate({
    value,
    selectionStart,
    selectionEnd,
    template: templateId,
});

interface MathFormulaToolbarProps {
    value: string;
    targetRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
    onValueChange: (value: string) => void;
}

const FORMULA_BUTTONS: Array<{ id: MathTemplateId; label: string; title: string }> = [
    { id: 'fraction', label: 'a⁄b', title: 'Phân số' },
    { id: 'sqrt', label: '√', title: 'Căn bậc hai' },
    { id: 'power', label: 'xⁿ', title: 'Số mũ' },
    { id: 'subscript', label: 'xₙ', title: 'Chỉ số dưới' },
    { id: 'angle', label: '∠', title: 'Góc' },
];

export const MathFormulaToolbar: React.FC<MathFormulaToolbarProps> = ({ value, targetRef, onValueChange }) => {
    const [showGeometry, setShowGeometry] = useState(false);

    const applyTemplate = useCallback((templateId: MathTemplateId) => {
        const target = targetRef.current;
        if (!target) return;
        const result = insertFormulaTemplate(
            value,
            target.selectionStart ?? value.length,
            target.selectionEnd ?? target.selectionStart ?? value.length,
            templateId,
        );
        onValueChange(result.value);
        setShowGeometry(false);
        requestAnimationFrame(() => {
            const nextTarget = targetRef.current;
            nextTarget?.focus();
            nextTarget?.setSelectionRange(result.selectionStart, result.selectionEnd);
        });
    }, [onValueChange, targetRef, value]);

    return (
        <div
            className="hidden group-focus-within/math:flex mt-1.5 flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1.5"
            data-testid="math-formula-toolbar"
        >
            <span className="px-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">Công thức</span>
            {FORMULA_BUTTONS.map((button) => (
                <button
                    key={button.id}
                    type="button"
                    title={button.title}
                    aria-label={button.title}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => applyTemplate(button.id)}
                    className="min-w-8 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-blue-900 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                >
                    {button.label}
                </button>
            ))}
            <div className="relative">
                <button
                    type="button"
                    aria-label="Hình học"
                    title="Hình học"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => setShowGeometry((current) => !current)}
                    className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-blue-900 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                >
                    Hình học ▾
                </button>
                {showGeometry && (
                    <div className="absolute left-0 top-full z-20 mt-1 w-36 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                        {[
                            ['segment', 'Đoạn thẳng AB'],
                            ['triangle', 'Tam giác ABC'],
                            ['parallel', 'Song song'],
                            ['perpendicular', 'Vuông góc'],
                        ].map(([id, label]) => (
                            <button
                                key={id}
                                type="button"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => applyTemplate(id as MathTemplateId)}
                                className="block w-full rounded px-2 py-1.5 text-left text-xs text-blue-900 hover:bg-blue-50 hover:text-blue-700"
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export const RemoveBtn: React.FC<{ onClick: () => void; title?: string }> = ({
    onClick,
    title = 'Xóa',
}) => (
    <button
        type="button"
        onClick={onClick}
        className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1 rounded transition-colors"
        title={title}
    >
        ✕
    </button>
);

export const AddRowBtn: React.FC<{ onClick: () => void; label: string }> = ({
    onClick,
    label,
}) => (
    <button
        type="button"
        onClick={onClick}
        className="text-sm text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 mt-1"
    >
        + {label}
    </button>
);

type TextInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
    value: string;
    showMathPreview?: boolean;
    showMathToolbar?: boolean;
};

export const TextInput = React.forwardRef<HTMLInputElement, TextInputProps>(({
    showMathPreview = true,
    showMathToolbar = showMathPreview,
    onChange,
    onFocus,
    onSelect,
    onClick,
    onKeyUp,
    ...props
}, forwardedRef) => {
    const localRef = useRef<HTMLInputElement>(null);
    const setRef = useCallback((node: HTMLInputElement | null) => {
        localRef.current = node;
        if (typeof forwardedRef === 'function') forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
    }, [forwardedRef]);

    const updateValue = useCallback((nextValue: string) => {
        const target = localRef.current;
        if (!target || !onChange) return;
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(target, nextValue);
        target.dispatchEvent(new Event('input', { bubbles: true }));
    }, [onChange]);
    const composerField = useMathComposerField(
        localRef,
        updateValue,
        String(props['aria-label'] || props.placeholder || 'Ô nhập công thức'),
    );

    return (
        <div className="group/math w-full min-w-0">
            <input
                {...props}
                ref={setRef}
                onChange={(event) => {
                    onChange?.(event);
                    composerField.activate();
                    composerField.capture();
                }}
                onFocus={(event) => {
                    onFocus?.(event);
                    composerField.activate();
                }}
                onSelect={(event) => {
                    onSelect?.(event);
                    composerField.capture();
                }}
                onClick={(event) => {
                    onClick?.(event);
                    composerField.capture();
                }}
                onKeyUp={(event) => {
                    onKeyUp?.(event);
                    composerField.capture();
                }}
                className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow text-sm ${props.className ?? ''}`}
            />
            {showMathToolbar && !composerField.hasVisualComposer && (
                <MathFormulaToolbar value={props.value} targetRef={localRef} onValueChange={updateValue} />
            )}
            {showMathPreview && <MathFieldPreview value={props.value} />}
        </div>
    );
});
TextInput.displayName = 'TextInput';

type MathTextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
    value: string;
    showMathPreview?: boolean;
    showMathToolbar?: boolean;
};

export const MathTextarea = React.forwardRef<HTMLTextAreaElement, MathTextareaProps>(({
    showMathPreview = true,
    showMathToolbar = true,
    onChange,
    onFocus,
    onSelect,
    onClick,
    onKeyUp,
    ...props
}, forwardedRef) => {
    const localRef = useRef<HTMLTextAreaElement>(null);
    const setRef = useCallback((node: HTMLTextAreaElement | null) => {
        localRef.current = node;
        if (typeof forwardedRef === 'function') forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
    }, [forwardedRef]);

    const updateValue = useCallback((nextValue: string) => {
        const target = localRef.current;
        if (!target || !onChange) return;
        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set?.call(target, nextValue);
        target.dispatchEvent(new Event('input', { bubbles: true }));
    }, [onChange]);
    const composerField = useMathComposerField(
        localRef,
        updateValue,
        String(props['aria-label'] || props.placeholder || 'Ô nhập công thức'),
    );

    return (
        <div className="group/math w-full min-w-0">
            <textarea
                {...props}
                ref={setRef}
                onChange={(event) => {
                    onChange?.(event);
                    composerField.activate();
                    composerField.capture();
                }}
                onFocus={(event) => {
                    onFocus?.(event);
                    composerField.activate();
                }}
                onSelect={(event) => {
                    onSelect?.(event);
                    composerField.capture();
                }}
                onClick={(event) => {
                    onClick?.(event);
                    composerField.capture();
                }}
                onKeyUp={(event) => {
                    onKeyUp?.(event);
                    composerField.capture();
                }}
                className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow text-sm ${props.className ?? ''}`}
            />
            {showMathToolbar && !composerField.hasVisualComposer && (
                <MathFormulaToolbar value={props.value} targetRef={localRef} onValueChange={updateValue} />
            )}
            {showMathPreview && <MathFieldPreview value={props.value} />}
        </div>
    );
});
MathTextarea.displayName = 'MathTextarea';
