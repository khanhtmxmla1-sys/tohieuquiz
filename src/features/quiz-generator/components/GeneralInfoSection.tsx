import React from 'react';
import { Clock, FileText, Lightbulb, Lock, Tag, X } from 'lucide-react';
import CollapsibleSection from './CollapsibleSection';
import { QUIZ_CATEGORIES } from '../../../config/constants';

interface GeneralInfoSectionProps {
    topic: string;
    setTopic: (value: string) => void;
    quizTitle: string;
    setQuizTitle: (value: string) => void;
    classLevel: string;
    setClassLevel: (value: string) => void;
    manualTimeLimit: number | '';
    setManualTimeLimit: (value: number | '') => void;
    category: string;
    setCategory: (value: string) => void;
    tags: string[];
    setTags: (value: string[]) => void;
    tagInput: string;
    setTagInput: (value: string) => void;
    isOpen: boolean;
    onToggle: (id: string) => void;
    isClassLocked: boolean;
    isPdfMode: boolean;
    aiSuggestions: {
        category: string | null;
        lesson: string;
        tags: string[];
    };
    onApplyAiCategory: () => void;
    onApplyAiTitle: () => void;
    onAddTag: (tag: string) => void;
}

const GeneralInfoSection: React.FC<GeneralInfoSectionProps> = ({
    topic,
    setTopic,
    quizTitle,
    setQuizTitle,
    classLevel,
    setClassLevel,
    manualTimeLimit,
    setManualTimeLimit,
    category,
    setCategory,
    tags,
    setTags,
    tagInput,
    setTagInput,
    isOpen,
    onToggle,
    isClassLocked,
    isPdfMode,
    aiSuggestions,
    onApplyAiCategory,
    onApplyAiTitle,
    onAddTag,
}) => {
    const hasAiSuggestions = Boolean(
        aiSuggestions.category
        || aiSuggestions.lesson
        || aiSuggestions.tags.length > 0,
    );

    const categoryLabel = aiSuggestions.category
        ? QUIZ_CATEGORIES.find((item) => item.id === aiSuggestions.category)?.name
            ?? aiSuggestions.category
        : '';
    const uniqueSuggestedTags = [...new Set(aiSuggestions.tags)];

    const applyAllSuggestions = () => {
        if (aiSuggestions.category) onApplyAiCategory();
        if (!quizTitle.trim() && aiSuggestions.lesson) onApplyAiTitle();
        uniqueSuggestedTags.forEach(onAddTag);
    };

    return (
        <CollapsibleSection
            id="basic"
            icon={<FileText className="h-4 w-4" />}
            title="Thông tin cơ bản"
            subtitle="Chủ đề, khối lớp, thời gian"
            isOpen={isOpen}
            onToggle={onToggle}
        >
            <div className="space-y-3">
                <div>
                    <label className="mb-1 block text-sm font-semibold text-gray-700">
                        Chủ đề bài học {!isPdfMode && <span className="text-red-500">*</span>}
                    </label>
                    <input
                        type="text"
                        value={topic}
                        onChange={(event) => setTopic(event.target.value)}
                        placeholder="Ví dụ: Động vật rừng xanh, phép cộng có nhớ..."
                        className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm transition-all focus:border-orange-500 focus:ring-2 focus:ring-orange-500/40"
                    />
                </div>

                <div>
                    <label className="mb-1 block text-sm font-semibold text-gray-700">Tên bài kiểm tra</label>
                    <input
                        type="text"
                        value={quizTitle}
                        onChange={(event) => setQuizTitle(event.target.value)}
                        placeholder="Ví dụ: Kiểm tra 15 phút - Chương 3..."
                        className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm transition-all focus:border-orange-500 focus:ring-2 focus:ring-orange-500/40"
                    />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                        <label className="mb-1 block text-xs font-semibold text-gray-600">
                            Khối lớp {isClassLocked && <Lock className="inline h-3 w-3 text-orange-500" />}
                        </label>
                        <select
                            value={classLevel}
                            onChange={(event) => setClassLevel(event.target.value)}
                            disabled={isClassLocked}
                            className={`w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500/40 ${
                                isClassLocked
                                    ? 'cursor-not-allowed bg-gray-50 text-gray-500'
                                    : 'border-gray-200'
                            }`}
                        >
                            {[1, 2, 3, 4, 5].map((level) => (
                                <option key={level} value={String(level)}>Lớp {level}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-semibold text-gray-600">
                            <Clock className="mr-1 inline h-3 w-3" />Thời gian
                        </label>
                        <input
                            type="number"
                            min={1}
                            value={manualTimeLimit}
                            onChange={(event) => {
                                const value = event.target.value;
                                setManualTimeLimit(value === '' ? '' : Number.parseInt(value, 10));
                            }}
                            placeholder="Tự động"
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500/40"
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-semibold text-gray-600">Danh mục</label>
                        <select
                            value={category}
                            onChange={(event) => setCategory(event.target.value)}
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500/40"
                        >
                            {QUIZ_CATEGORIES.map((item) => (
                                <option key={item.id} value={item.id}>{item.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-600">
                        <Tag className="mr-1 inline h-3 w-3" />Nhãn
                    </label>
                    <div className="mb-1.5 flex flex-wrap gap-1">
                        {tags.map((tag) => (
                            <span
                                key={tag}
                                className="inline-flex items-center gap-0.5 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600"
                            >
                                {tag}
                                <button
                                    type="button"
                                    aria-label={`Xóa nhãn ${tag}`}
                                    onClick={() => setTags(tags.filter((item) => item !== tag))}
                                    className="ml-0.5 hover:text-red-500"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </span>
                        ))}
                    </div>
                    <input
                        type="text"
                        value={tagInput}
                        onChange={(event) => setTagInput(event.target.value)}
                        onKeyDown={(event) => {
                            if ((event.key === 'Enter' || event.key === ',') && tagInput.trim()) {
                                event.preventDefault();
                                onAddTag(tagInput);
                                setTagInput('');
                            }
                        }}
                        placeholder="Gõ nhãn rồi nhấn Enter"
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500/40"
                    />
                </div>

                {hasAiSuggestions && (
                    <section className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/80 p-3">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <p className="flex items-center gap-2 text-sm font-bold text-emerald-800">
                                <Lightbulb className="h-4 w-4" />
                                Gợi ý từ AI
                            </p>
                            <button
                                type="button"
                                onClick={applyAllSuggestions}
                                className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-800"
                            >
                                Áp dụng tất cả
                            </button>
                        </div>

                        <div className="space-y-2">
                            {aiSuggestions.category && (
                                <div className="flex flex-col gap-2 rounded-lg border border-emerald-100 bg-white p-2.5 sm:flex-row sm:items-center sm:justify-between">
                                    <span className="text-sm text-gray-700">
                                        Môn học: <strong>{categoryLabel}</strong>
                                    </span>
                                    <button
                                        type="button"
                                        onClick={onApplyAiCategory}
                                        className="rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-50"
                                    >
                                        Áp dụng môn học
                                    </button>
                                </div>
                            )}

                            {aiSuggestions.lesson && (
                                <div className="flex flex-col gap-2 rounded-lg border border-emerald-100 bg-white p-2.5 sm:flex-row sm:items-center sm:justify-between">
                                    <span className="text-sm text-gray-700">
                                        Tên bài: <strong>{aiSuggestions.lesson}</strong>
                                    </span>
                                    <button
                                        type="button"
                                        onClick={onApplyAiTitle}
                                        className="rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-50"
                                    >
                                        Dùng tên bài này
                                    </button>
                                </div>
                            )}

                            {uniqueSuggestedTags.length > 0 && (
                                <div className="rounded-lg border border-emerald-100 bg-white p-2.5">
                                    <p className="mb-2 text-xs font-semibold text-gray-600">Nhãn được đề xuất</p>
                                    <div className="flex flex-wrap gap-2">
                                        {uniqueSuggestedTags.map((tag) => (
                                            <button
                                                key={tag}
                                                type="button"
                                                onClick={() => onAddTag(tag)}
                                                className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-100"
                                            >
                                                Thêm nhãn {tag}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {quizTitle.trim() && aiSuggestions.lesson && (
                            <p className="text-xs text-emerald-800">
                                “Áp dụng tất cả” giữ nguyên tên bài bạn đã nhập. Dùng nút “Dùng tên bài này” để thay thế tên bài.
                            </p>
                        )}
                    </section>
                )}
            </div>
        </CollapsibleSection>
    );
};

export default GeneralInfoSection;
