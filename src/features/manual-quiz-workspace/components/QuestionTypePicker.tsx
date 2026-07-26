import React, { useEffect, useRef } from 'react';
import { Plus, X } from 'lucide-react';
import { QuestionType } from '../../../types';
import { QUESTION_TYPE_GROUPS } from '../../../components/TeacherDashboard/quiz-preview/questionTypes';

interface QuestionTypePickerProps {
    open: boolean;
    onSelect(type: QuestionType): void;
    onClose(): void;
}

const QuestionTypePicker: React.FC<QuestionTypePickerProps> = ({
    open,
    onSelect,
    onClose,
}) => {
    const closeButtonRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (open) closeButtonRef.current?.focus();
    }, [open]);

    useEffect(() => {
        if (!open) return undefined;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose, open]);

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-[80] grid place-items-center bg-slate-900/50 p-4 backdrop-blur-sm"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <section
                role="dialog"
                aria-modal="true"
                aria-label="Chọn dạng câu hỏi"
                className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            >
                <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-5 lg:px-6">
                    <div>
                        <h2 className="text-xl font-semibold text-slate-900">Chọn dạng câu hỏi</h2>
                        <p className="mt-1 text-sm text-slate-600">
                            Bấm một dạng để thêm ngay và mở trình soạn tương ứng.
                        </p>
                    </div>
                    <button
                        ref={closeButtonRef}
                        type="button"
                        onClick={onClose}
                        aria-label="Đóng bộ chọn dạng câu hỏi"
                        className="grid h-11 w-11 shrink-0 place-items-center rounded-[10px] text-slate-500 hover:bg-slate-100"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </header>

                <div className="min-h-0 flex-1 space-y-7 overflow-y-auto px-5 py-5 lg:px-6">
                    {QUESTION_TYPE_GROUPS.map((group) => (
                        <section key={group.id}>
                            <h3 className="text-base font-semibold text-slate-900">{group.label}</h3>
                            <p className="mt-1 text-sm text-slate-500">{group.description}</p>
                            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                {group.items.map((item) => (
                                    <button
                                        key={item.type}
                                        type="button"
                                        onClick={() => onSelect(item.type)}
                                        aria-label={`Thêm dạng ${item.label}`}
                                        className="min-h-32 rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-sky-400 hover:bg-sky-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-500"
                                    >
                                        <span className="flex items-center justify-between gap-2">
                                            <strong className="text-sm text-slate-900">{item.label}</strong>
                                            <Plus className="h-4 w-4 shrink-0 text-sky-600" />
                                        </span>
                                        <span className="mt-2 block text-sm leading-5 text-slate-600">
                                            {item.description}
                                        </span>
                                        <span className="mt-2 block text-xs leading-5 text-slate-500">
                                            {item.example}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </section>
                    ))}
                </div>
            </section>
        </div>
    );
};

export default QuestionTypePicker;
