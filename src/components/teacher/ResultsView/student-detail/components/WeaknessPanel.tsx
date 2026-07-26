import React from 'react';
import { AlertCircle } from 'lucide-react';
import type { SkillBreakdownItem, WeaknessProfileResponse } from '../../../../../shared/skillTaxonomy';
import type { SmartAssignmentPreviewApiResponse, SmartAssignmentPreviewData } from '../../../../../types/classroom.types';
import { SmartAssignmentPanel } from './SmartAssignmentPanel';
import { WeaknessSkillList } from './WeaknessSkillList';

interface WeaknessPanelProps {
    profile: WeaknessProfileResponse | null;
    focusSkills: SkillBreakdownItem[];
    isLoading: boolean;
    error: string | null;
    showCoverageWarning: boolean;
    studentName: string;
    smartPreview: SmartAssignmentPreviewData | null;
    smartPreviewError: string | null;
    smartPreviewErrorDetails: SmartAssignmentPreviewApiResponse['data'] | null;
    isSmartPreviewLoading: boolean;
    selectedPreviewQuizId: string;
    smartDeadline: string;
    smartMaxAttempts: number;
    onLoadSmartPreview: () => void;
    onPreviewQuizChange: (value: string) => void;
    onDeadlineChange: (value: string) => void;
    onMaxAttemptsChange: (value: number) => void;
    onUseSmartPreview: () => void;
}

export const WeaknessPanel: React.FC<WeaknessPanelProps> = (props) => (
    <div className="bg-white p-6 rounded-[2rem] shadow-xl shadow-blue-900/5 border border-white">
        <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500" /> Kỹ năng cần chú ý
        </h4>
        {props.isLoading ? (
            <div className="space-y-3">
                {[0, 1, 2].map((item) => (
                    <div key={item} className="animate-pulse rounded-2xl border border-slate-100 bg-slate-50 p-4">
                        <div className="h-3 w-32 rounded bg-slate-200 mb-3" />
                        <div className="h-2 w-full rounded bg-slate-200 mb-2" />
                        <div className="h-2 w-20 rounded bg-slate-200" />
                    </div>
                ))}
            </div>
        ) : props.error ? (
            <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{props.error}</div>
        ) : (
            <div className="space-y-3">
                {props.showCoverageWarning && props.profile && (
                    <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs text-amber-700 leading-relaxed">
                        Dữ liệu phân loại mới phủ {props.profile.coveragePercent}% số câu. Hiện còn {props.profile.unclassifiedQuestionCount} câu chưa map kỹ năng, nên anh xem đây là tín hiệu sớm để ưu tiên kiểm tra thêm.
                    </div>
                )}
                <WeaknessSkillList skills={props.focusSkills} />
                {props.focusSkills.length > 0 && (
                    <SmartAssignmentPanel
                        preview={props.smartPreview}
                        error={props.smartPreviewError}
                        errorDetails={props.smartPreviewErrorDetails}
                        isLoading={props.isSmartPreviewLoading}
                        selectedQuizId={props.selectedPreviewQuizId}
                        deadline={props.smartDeadline}
                        maxAttempts={props.smartMaxAttempts}
                        onLoad={props.onLoadSmartPreview}
                        onQuizChange={props.onPreviewQuizChange}
                        onDeadlineChange={props.onDeadlineChange}
                        onMaxAttemptsChange={props.onMaxAttemptsChange}
                        onUse={props.onUseSmartPreview}
                    />
                )}
                {props.profile && (
                    <p className="text-[11px] text-slate-400 font-medium">
                        Tổng hợp từ {props.profile.basedOnResultIds.length} bài gần nhất của {props.studentName}.
                    </p>
                )}
            </div>
        )}
    </div>
);
