import React from 'react';
import { BookMarked, GraduationCap, HeartHandshake, ShieldCheck } from 'lucide-react';
import CollapsibleSection from './CollapsibleSection';
import type { LearnerPromptMode, PromptProfileOptions } from '../../../services/geminiService';

interface PedagogicalProfileSectionProps {
    promptProfile: PromptProfileOptions;
    profilePresetNotice: string | null;
    isOpen: boolean;
    onToggle: (id: string) => void;
    onToggleThongTu27: () => void;
    onSelectLearnerMode: (mode: LearnerPromptMode) => void;
}

const baseCardClass = 'w-full rounded-2xl border p-4 text-left transition-colors shadow-sm';

const PedagogicalProfileSection: React.FC<PedagogicalProfileSectionProps> = ({
    promptProfile,
    profilePresetNotice,
    isOpen,
    onToggle,
    onToggleThongTu27,
    onSelectLearnerMode,
}) => {
    const isThongTu27Enabled = promptProfile.useThongTu27;

    return (
        <CollapsibleSection
            id="pedagogy"
            icon={<BookMarked className="h-4 w-4" />}
            title="Định hướng ra đề"
            subtitle="Thông tư 27, bồi dưỡng học sinh giỏi, phụ đạo học sinh"
            isOpen={isOpen}
            onToggle={onToggle}
        >
            <div className="space-y-3">
                <button
                    type="button"
                    onClick={onToggleThongTu27}
                    aria-pressed={isThongTu27Enabled}
                    className={`${baseCardClass} ${
                        isThongTu27Enabled
                            ? 'border-blue-500 bg-blue-50 text-blue-900 shadow-blue-100'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    }`}
                >
                    <div className="flex items-start gap-3">
                        <div className={`rounded-xl p-2 ${
                            isThongTu27Enabled
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-100 text-slate-500'
                        }`}
                        >
                            <ShieldCheck className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center justify-between gap-3">
                                <h4 className="text-sm font-bold">Bám Thông tư 27</h4>
                                <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${
                                    isThongTu27Enabled
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-slate-100 text-slate-500'
                                }`}
                                >
                                    {isThongTu27Enabled ? 'Đang bật' : 'Đang tắt'}
                                </span>
                            </div>
                            <p className="mt-1 text-xs leading-5 text-slate-600">
                                Bám chuẩn đánh giá tiểu học, dùng ngôn ngữ phù hợp lứa tuổi, ưu tiên câu hỏi có ý nghĩa học tập và phân hóa hợp lý.
                            </p>
                        </div>
                    </div>
                </button>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <button
                        type="button"
                        disabled={!isThongTu27Enabled}
                        aria-pressed={promptProfile.learnerMode === 'gifted'}
                        onClick={() => onSelectLearnerMode(
                            promptProfile.learnerMode === 'gifted' ? 'default' : 'gifted',
                        )}
                        className={`${baseCardClass} ${
                            promptProfile.learnerMode === 'gifted'
                                ? 'border-amber-500 bg-amber-50 text-amber-900 shadow-amber-100'
                                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                        } ${!isThongTu27Enabled ? 'cursor-not-allowed opacity-50' : ''}`}
                    >
                        <div className="flex items-start gap-3">
                            <div className={`rounded-xl p-2 ${
                                promptProfile.learnerMode === 'gifted'
                                    ? 'bg-amber-500 text-white'
                                    : 'bg-slate-100 text-slate-500'
                            }`}
                            >
                                <GraduationCap className="h-5 w-5" />
                            </div>
                            <div className="flex-1">
                                <h4 className="text-sm font-bold">Bồi dưỡng học sinh giỏi</h4>
                                <p className="mt-1 text-xs leading-5 text-slate-600">
                                    Tăng câu suy luận và vận dụng, hướng rõ vào nhóm khá giỏi nhưng vẫn trong phạm vi chương trình tiểu học.
                                </p>
                                {!isThongTu27Enabled && (
                                    <p className="mt-2 text-[11px] font-medium text-slate-400">
                                        Bật Thông tư 27 để sử dụng định hướng này.
                                    </p>
                                )}
                            </div>
                        </div>
                    </button>

                    <button
                        type="button"
                        disabled={!isThongTu27Enabled}
                        aria-pressed={promptProfile.learnerMode === 'remedial'}
                        onClick={() => onSelectLearnerMode(
                            promptProfile.learnerMode === 'remedial' ? 'default' : 'remedial',
                        )}
                        className={`${baseCardClass} ${
                            promptProfile.learnerMode === 'remedial'
                                ? 'border-emerald-500 bg-emerald-50 text-emerald-900 shadow-emerald-100'
                                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                        } ${!isThongTu27Enabled ? 'cursor-not-allowed opacity-50' : ''}`}
                    >
                        <div className="flex items-start gap-3">
                            <div className={`rounded-xl p-2 ${
                                promptProfile.learnerMode === 'remedial'
                                    ? 'bg-emerald-500 text-white'
                                    : 'bg-slate-100 text-slate-500'
                            }`}
                            >
                                <HeartHandshake className="h-5 w-5" />
                            </div>
                            <div className="flex-1">
                                <h4 className="text-sm font-bold">Phụ đạo học sinh cần hỗ trợ</h4>
                                <p className="mt-1 text-xs leading-5 text-slate-600">
                                    Ưu tiên kiến thức cốt lõi, tăng câu nhận biết và thông hiểu gần gũi, giảm phương án nhiễu gây rối.
                                </p>
                                {!isThongTu27Enabled && (
                                    <p className="mt-2 text-[11px] font-medium text-slate-400">
                                        Bật Thông tư 27 để sử dụng định hướng này.
                                    </p>
                                )}
                            </div>
                        </div>
                    </button>
                </div>

                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Trạng thái hiện tại</p>
                    <p className="mt-1 text-sm font-medium text-slate-700">
                        {!isThongTu27Enabled
                            ? 'Đang dùng chế độ tạo đề thông thường.'
                            : promptProfile.learnerMode === 'gifted'
                                ? 'Đang dùng chuẩn Thông tư 27 và định hướng bồi dưỡng học sinh giỏi.'
                                : promptProfile.learnerMode === 'remedial'
                                    ? 'Đang dùng chuẩn Thông tư 27 và định hướng phụ đạo học sinh cần hỗ trợ.'
                                    : 'Đang dùng chuẩn Thông tư 27.'}
                    </p>
                    {profilePresetNotice && (
                        <p className="mt-2 text-xs text-slate-500">{profilePresetNotice}</p>
                    )}
                </div>
            </div>
        </CollapsibleSection>
    );
};

export default PedagogicalProfileSection;
