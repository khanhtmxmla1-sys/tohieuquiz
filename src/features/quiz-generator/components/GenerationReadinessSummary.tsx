import React from 'react';
import { FlaskConical, Gauge, Layers3 } from 'lucide-react';
import type { DifficultyLevels, QuizMode } from '../domain/quizCreation.types';

interface GenerationReadinessSummaryProps {
    questionCount: number;
    selectedTypeCount: number;
    difficultyLevels: DifficultyLevels;
    isTeacherAccount: boolean;
    aiUsageRemaining: number;
    dailyAiLimit: number;
    trialMode: QuizMode;
    trialDisabled: boolean;
    onGenerateTrial: (mode: QuizMode) => void;
}

const GenerationReadinessSummary: React.FC<GenerationReadinessSummaryProps> = ({
    questionCount,
    selectedTypeCount,
    difficultyLevels,
    isTeacherAccount,
    aiUsageRemaining,
    dailyAiLimit,
    trialMode,
    trialDisabled,
    onGenerateTrial,
}) => (
    <section
        className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950"
        aria-labelledby="generation-readiness-title"
    >
        <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
                <h3 id="generation-readiness-title" className="flex items-center gap-2 font-bold">
                    <Layers3 className="h-4 w-4" aria-hidden="true" />
                    Cấu hình trước khi tạo
                </h3>
                <p className="mt-1 text-blue-800">
                    {questionCount} câu · {selectedTypeCount} dạng · Dễ {difficultyLevels.level1}, Trung bình {difficultyLevels.level2}, Khó {difficultyLevels.level3}
                </p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 font-bold text-blue-800 shadow-sm">
                <Gauge className="h-4 w-4" aria-hidden="true" />
                {isTeacherAccount ? `${aiUsageRemaining}/${dailyAiLimit} lượt còn lại` : 'Không giới hạn'}
            </span>
        </div>
        {questionCount > 3 && (
            <div className="mt-3 flex flex-col gap-2 rounded-lg border border-blue-100 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-slate-700">
                    Xem trước 3 câu đại diện trước khi tạo đề đầy đủ. Bản thử dùng 1 lượt AI và không thể lưu.
                </p>
                <button
                    type="button"
                    onClick={() => onGenerateTrial(trialMode)}
                    disabled={trialDisabled}
                    className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-blue-300 bg-blue-100 px-4 py-2 font-bold text-blue-900 hover:bg-blue-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <FlaskConical className="h-4 w-4" aria-hidden="true" />
                    Tạo thử 3 câu
                </button>
            </div>
        )}
    </section>
);

export default GenerationReadinessSummary;
