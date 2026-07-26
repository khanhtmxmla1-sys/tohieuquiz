import React from 'react';
import type { SmartAssignmentPreviewData } from '../../../../../types/classroom.types';
import { getSkillStatusLabel } from '../models/weaknessModel';

interface SmartPreviewFormProps {
    preview: SmartAssignmentPreviewData;
    selectedQuizId: string;
    deadline: string;
    maxAttempts: number;
    onQuizChange: (value: string) => void;
    onDeadlineChange: (value: string) => void;
    onMaxAttemptsChange: (value: number) => void;
    onUse: () => void;
}

export const SmartPreviewForm: React.FC<SmartPreviewFormProps> = (props) => (
    <div className="mt-4 space-y-4">
        <div className="rounded-2xl border border-white bg-white p-4">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-sm font-black text-slate-800">Ky nang uu tien</p>
                    <p className="mt-1 text-sm text-slate-600">
                        {props.preview.weaknessSummary.topSkill.skillLabel} - {getSkillStatusLabel(props.preview.weaknessSummary.topSkill.status)} ({props.preview.weaknessSummary.topSkill.accuracy}%)
                    </p>
                    <p className="mt-2 text-[11px] font-medium text-slate-500">
                        Muc goi y: {props.preview.weaknessSummary.topSkill.targetDifficulty}
                        {props.preview.weaknessSummary.topSkill.subskillLabel && ` • ${props.preview.weaknessSummary.topSkill.subskillLabel}`}
                    </p>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-slate-500">
                    {props.preview.student.className}
                </span>
            </div>
            {props.preview.warnings.map((warning) => (
                <div key={warning.code} className="mt-3 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    {warning.message}
                </div>
            ))}
        </div>
        <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">De goi y</label>
            <select
                value={props.selectedQuizId}
                onChange={(event) => props.onQuizChange(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            >
                {props.preview.recommendedQuizzes.map((quiz) => (
                    <option key={quiz.quizId} value={quiz.quizId}>
                        {quiz.title} - {quiz.questionCount} cau - {quiz.matchReason} - {Math.round(quiz.confidence * 100)}%
                    </option>
                ))}
            </select>
            {props.preview.recommendedQuizzes
                .filter((quiz) => quiz.quizId === props.selectedQuizId)
                .map((quiz) => (
                    <p key={`${quiz.quizId}-reason`} className="mt-2 text-xs text-slate-500">
                        {quiz.matchReason} • Tong diem {quiz.matchBreakdown.totalScore}
                    </p>
                ))}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Han nop
                <input
                    type="datetime-local"
                    value={props.deadline}
                    onChange={(event) => props.onDeadlineChange(event.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-normal normal-case text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
            </label>
            <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
                So luot lam
                <input
                    type="number" min={1} max={10} value={props.maxAttempts}
                    onChange={(event) => props.onMaxAttemptsChange(Math.max(1, Math.min(10, Number(event.target.value) || 1)))}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-normal normal-case text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
            </label>
        </div>
        <button onClick={props.onUse} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors">
            Dung trong AssignmentTab
        </button>
    </div>
);
