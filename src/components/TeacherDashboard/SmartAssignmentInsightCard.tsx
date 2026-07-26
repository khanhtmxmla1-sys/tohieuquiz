import React from 'react';
import { AlertTriangle, CheckCircle2, Edit3, Sparkles } from 'lucide-react';

export type InterventionDecisionState =
    | 'recommended'
    | 'review'
    | 'low-confidence'
    | 'manual-adjusted';

export interface SmartAssignmentInsightViewModel {
    state: InterventionDecisionState;
    source: 'smart-preview' | 'manual';
    title: string;
    summary: string;
    skillLabel?: string;
    subskillLabel?: string;
    statusLabel?: string;
    accuracy?: number;
    targetDifficultyLabel?: string;
    matchReason?: string;
    confidencePercent?: number;
    className?: string;
    studentName?: string;
    quizTitle?: string;
    warningMessages: string[];
    manualNotice?: string | null;
}

type SmartAssignmentInsightCardProps = {
    model: SmartAssignmentInsightViewModel;
    actions?: React.ReactNode;
};

const stateStyles: Record<InterventionDecisionState, {
    container: string;
    badge: string;
    title: string;
    icon: React.ReactNode;
    badgeLabel: string;
}> = {
    recommended: {
        container: 'border-indigo-100 bg-gradient-to-r from-indigo-50 via-white to-sky-50',
        badge: 'bg-indigo-50 text-indigo-700',
        title: 'text-indigo-600',
        icon: <Sparkles className="h-4 w-4" />,
        badgeLabel: 'San sang giao bai',
    },
    review: {
        container: 'border-sky-100 bg-sky-50/70',
        badge: 'bg-white text-sky-700',
        title: 'text-sky-700',
        icon: <AlertTriangle className="h-4 w-4" />,
        badgeLabel: 'Nen xem lai',
    },
    'low-confidence': {
        container: 'border-amber-200 bg-amber-50/80',
        badge: 'bg-white text-amber-700',
        title: 'text-amber-700',
        icon: <AlertTriangle className="h-4 w-4" />,
        badgeLabel: 'Do tin cay thap',
    },
    'manual-adjusted': {
        container: 'border-slate-200 bg-slate-50',
        badge: 'bg-white text-slate-700',
        title: 'text-slate-700',
        icon: <Edit3 className="h-4 w-4" />,
        badgeLabel: 'Da chinh tay',
    },
};

const SmartAssignmentInsightCard: React.FC<SmartAssignmentInsightCardProps> = ({ model, actions }) => {
    const style = stateStyles[model.state];

    return (
        <div className={`mb-5 rounded-2xl border p-4 ${style.container}`}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                    <div className={`flex items-center gap-2 text-sm font-black uppercase tracking-wide ${style.title}`}>
                        {style.icon}
                        <span>Da nap goi y tu ket qua hoc sinh</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <p className="text-base font-bold text-slate-800">
                            {model.studentName || 'Hoc sinh'}
                            {model.className ? ` - ${model.className}` : ''}
                        </p>
                        <span className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wide shadow-sm ${style.badge}`}>
                            {style.badgeLabel}
                        </span>
                    </div>
                    <p className="text-sm text-slate-600">{model.summary}</p>
                </div>

                {actions}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border border-white bg-white px-3 py-3">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Ky nang uu tien</p>
                    <p className="mt-1 text-sm font-semibold text-slate-800">{model.skillLabel || 'Chua xac dinh'}</p>
                    {model.subskillLabel && <p className="mt-1 text-xs text-slate-500">{model.subskillLabel}</p>}
                </div>
                <div className="rounded-xl border border-white bg-white px-3 py-3">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Muc do hien tai</p>
                    <p className="mt-1 text-sm font-semibold text-slate-800">{model.statusLabel || 'Dang xem xet'}</p>
                    {typeof model.accuracy === 'number' && (
                        <p className="mt-1 text-xs text-slate-500">Do chinh xac {model.accuracy}%</p>
                    )}
                </div>
                <div className="rounded-xl border border-white bg-white px-3 py-3">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">De bai hien tai</p>
                    <p className="mt-1 text-sm font-semibold text-slate-800">{model.quizTitle || 'Chua chon de'}</p>
                    {model.targetDifficultyLabel && (
                        <p className="mt-1 text-xs text-slate-500">{model.targetDifficultyLabel}</p>
                    )}
                </div>
                <div className="rounded-xl border border-white bg-white px-3 py-3">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Do tin cay</p>
                    <p className="mt-1 text-sm font-semibold text-slate-800">
                        {typeof model.confidencePercent === 'number' ? `${model.confidencePercent}%` : 'Can teacher xac nhan'}
                    </p>
                    {model.matchReason && <p className="mt-1 text-xs text-slate-500">{model.matchReason}</p>}
                </div>
            </div>

            {model.matchReason && (
                <div className="mt-4 rounded-xl border border-white bg-white px-4 py-3">
                    <p className="text-sm font-black text-slate-800">Vi sao de nay duoc goi y</p>
                    <p className="mt-1 text-sm text-slate-600">{model.matchReason}</p>
                </div>
            )}

            {model.manualNotice && (
                <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-800">
                    <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <p>{model.manualNotice}</p>
                </div>
            )}

            {model.warningMessages.length > 0 && (
                <div className="mt-3 space-y-2">
                    {model.warningMessages.map((warning) => (
                        <div
                            key={warning}
                            className="flex items-start gap-2 rounded-xl border border-amber-100 bg-amber-50 px-3 py-3 text-xs text-amber-800"
                        >
                            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                            <p>{warning}</p>
                        </div>
                    ))}
                </div>
            )}

            {model.state === 'recommended' && model.warningMessages.length === 0 && !model.manualNotice && (
                <div className="mt-3 flex items-start gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-3 text-xs text-emerald-700">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <p>Goi y nay da du ro de thay co giao bai ngay neu khong can chinh them.</p>
                </div>
            )}
        </div>
    );
};

export default SmartAssignmentInsightCard;
