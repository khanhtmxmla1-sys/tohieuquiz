import React, { useEffect, useMemo, useState } from 'react';
import { Calculator, X } from 'lucide-react';
import { insertMathTemplate } from './mathInsertion';
import {
    listMathTemplates,
    type MathTemplate,
    type MathTemplateCategory,
} from './mathTemplates';
import RecentFormulaList from './RecentFormulaList';
import {
    loadRecentMathFormulas,
    saveRecentMathFormula,
    type RecentMathFormula,
} from './recentMathFormulaRepository';
import StructuredFormulaDialog from './StructuredFormulaDialog';
import { useMathComposer } from './useMathComposer';

interface MathComposerPanelProps {
    ownerUsername: string;
    open: boolean;
    onClose(): void;
}

const CATEGORY_COPY: Array<{
    id: MathTemplateCategory;
    label: string;
}> = [
    { id: 'basic', label: 'Cơ bản' },
    { id: 'fractions', label: 'Phân số & số học' },
    { id: 'geometry', label: 'Hình học' },
    { id: 'symbols', label: 'Ký hiệu' },
    { id: 'examples', label: 'Mẫu thường dùng' },
];

const previewFormula = (
    template: MathTemplate,
    values: Record<string, string>,
): string => insertMathTemplate({
    value: '',
    selectionStart: 0,
    selectionEnd: 0,
    template,
    values,
}).value;

const MathComposerPanel: React.FC<MathComposerPanelProps> = ({
    ownerUsername,
    open,
    onClose,
}) => {
    const composer = useMathComposer();
    const templates = useMemo(() => listMathTemplates(), []);
    const [activeCategory, setActiveCategory] = useState<MathTemplateCategory>('fractions');
    const [structuredTemplate, setStructuredTemplate] = useState<MathTemplate | null>(null);
    const [recentFormulas, setRecentFormulas] = useState<RecentMathFormula[]>([]);

    useEffect(() => {
        setRecentFormulas(loadRecentMathFormulas(ownerUsername));
    }, [ownerUsername]);

    if (!open) return null;

    const activeTemplates = templates.filter((template) => template.category === activeCategory);

    const rememberAndInsert = (
        template: MathTemplate,
        values: Record<string, string>,
    ) => {
        const result = composer.insertTemplate(template.id, values);
        if (!result) return;
        setRecentFormulas(saveRecentMathFormula(ownerUsername, {
            templateId: template.id,
            values,
            label: template.title,
            preview: previewFormula(template, values),
        }));
    };

    const chooseTemplate = (template: MathTemplate) => {
        if (template.fields.length > 0) {
            setStructuredTemplate(template);
            return;
        }
        rememberAndInsert(template, {});
    };

    const insertRecent = (item: RecentMathFormula) => {
        const template = templates.find((candidate) => candidate.id === item.templateId);
        if (!template) return;
        rememberAndInsert(template, item.values);
    };

    return (
        <section
            aria-label="Bảng chèn công thức toán"
            className="sticky top-0 z-20 rounded-2xl border border-sky-200 bg-[#FFFDF7] p-4 lg:p-5"
        >
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h2 className="flex items-center gap-2 font-semibold text-slate-900">
                        <Calculator className="h-5 w-5 text-sky-700" /> Công thức toán
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">
                        {composer.activeFieldLabel
                            ? `Đang chèn vào: ${composer.activeFieldLabel}`
                            : 'Hãy bấm vào ô cần nhập công thức trước.'}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Đóng bảng công thức toán"
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-white"
                >
                    <X className="h-5 w-5" />
                </button>
            </div>

            <div
                role="tablist"
                aria-label="Nhóm công thức toán"
                className="mt-4 flex gap-2 overflow-x-auto pb-1"
            >
                {CATEGORY_COPY.map((category) => (
                    <button
                        key={category.id}
                        type="button"
                        role="tab"
                        aria-selected={activeCategory === category.id}
                        onClick={() => setActiveCategory(category.id)}
                        className={`min-h-11 shrink-0 rounded-[10px] border px-3 text-sm font-medium transition ${
                            activeCategory === category.id
                                ? 'border-sky-500 bg-sky-500 text-white'
                                : 'border-slate-200 bg-white text-slate-700 hover:border-sky-300'
                        }`}
                    >
                        {category.label}
                    </button>
                ))}
            </div>

            <div role="tabpanel" className="mt-4 flex flex-wrap gap-2">
                {activeTemplates.map((template) => (
                    <button
                        key={template.id}
                        type="button"
                        aria-label={template.title}
                        title={template.title}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => chooseTemplate(template)}
                        className="h-11 min-w-11 rounded-[10px] border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 hover:border-sky-400 hover:bg-sky-50"
                    >
                        {template.label}
                    </button>
                ))}
            </div>

            <RecentFormulaList items={recentFormulas} onInsert={insertRecent} />

            {structuredTemplate && (
                <StructuredFormulaDialog
                    template={structuredTemplate}
                    selectedText={composer.selectedText()}
                    onClose={() => setStructuredTemplate(null)}
                    onInsert={(values) => {
                        rememberAndInsert(structuredTemplate, values);
                        setStructuredTemplate(null);
                    }}
                />
            )}
        </section>
    );
};

export default MathComposerPanel;
