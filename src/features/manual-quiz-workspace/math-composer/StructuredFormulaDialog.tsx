import React, { useMemo, useState } from 'react';
import { Braces, X } from 'lucide-react';
import { NewlineMathText } from '../../../components/common';
import { insertMathTemplate } from './mathInsertion';
import type { MathTemplate } from './mathTemplates';

interface StructuredFormulaDialogProps {
    template: MathTemplate;
    selectedText?: string;
    onInsert(values: Record<string, string>): void;
    onClose(): void;
}

const createInitialValues = (
    template: MathTemplate,
    selectedText: string,
): Record<string, string> => Object.fromEntries(
    template.fields.map((field, index) => [field.key, index === 0 ? selectedText : '']),
);

const StructuredFormulaDialog: React.FC<StructuredFormulaDialogProps> = ({
    template,
    selectedText = '',
    onInsert,
    onClose,
}) => {
    const [values, setValues] = useState<Record<string, string>>(
        () => createInitialValues(template, selectedText),
    );
    const [showRawLatex, setShowRawLatex] = useState(false);
    const preview = useMemo(() => insertMathTemplate({
        value: '',
        selectionStart: 0,
        selectionEnd: 0,
        template,
        values,
    }).value, [template, values]);

    return (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-900/50 p-4 backdrop-blur-sm">
            <section
                role="dialog"
                aria-modal="true"
                aria-label={`Tạo công thức ${template.title}`}
                className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl lg:p-6"
            >
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-900">{template.title}</h2>
                        <p className="mt-1 text-sm text-slate-500">
                            Nhập từng phần, hệ thống sẽ tạo công thức giúp thầy cô.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Đóng hộp tạo công thức"
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    {template.fields.map((field) => (
                        <label key={field.key} className="text-sm font-medium text-slate-700">
                            {field.label}
                            <input
                                value={values[field.key] ?? ''}
                                onChange={(event) => setValues((current) => ({
                                    ...current,
                                    [field.key]: event.target.value,
                                }))}
                                placeholder={field.placeholder}
                                inputMode={field.inputMode}
                                className="mt-1.5 h-11 w-full rounded-[10px] border border-slate-200 bg-slate-50 px-3 outline-none focus:border-sky-500 focus:bg-white"
                            />
                        </label>
                    ))}
                </div>

                <div className="mt-5 rounded-xl border border-sky-100 bg-sky-50/60 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Xem trước</p>
                    <div className="mt-2 min-h-12 rounded-lg bg-white px-4 py-3 text-center text-lg">
                        <NewlineMathText content={preview} />
                    </div>
                </div>

                <button
                    type="button"
                    onClick={() => setShowRawLatex((current) => !current)}
                    className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                    aria-label={showRawLatex ? 'Ẩn mã LaTeX nâng cao' : 'Hiện mã LaTeX nâng cao'}
                >
                    <Braces className="h-4 w-4" />
                    {showRawLatex ? 'Ẩn mã LaTeX' : 'Tùy chọn nâng cao'}
                </button>
                {showRawLatex && (
                    <label className="mt-2 block text-xs font-medium text-slate-600">
                        Mã LaTeX
                        <input
                            aria-label="Mã LaTeX"
                            value={preview}
                            readOnly
                            className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 font-mono text-xs text-slate-700"
                        />
                    </label>
                )}

                <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="min-h-11 rounded-[10px] border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                        Hủy
                    </button>
                    <button
                        type="button"
                        onClick={() => onInsert(values)}
                        className="min-h-11 rounded-[10px] bg-sky-600 px-5 text-sm font-semibold text-white hover:bg-sky-700"
                    >
                        Chèn công thức
                    </button>
                </div>
            </section>
        </div>
    );
};

export default StructuredFormulaDialog;
