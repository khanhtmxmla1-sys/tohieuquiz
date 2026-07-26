import React, { type RefObject } from 'react';
import { AIInsightBox } from '../../../../../features/analytics/components/AIInsightBox';
import type { SkillBreakdownItem, WeaknessProfileResponse } from '../../../../../shared/skillTaxonomy';
import type { SmartAssignmentPreviewApiResponse, SmartAssignmentPreviewData } from '../../../../../types/classroom.types';
import type { CompetencyData } from '../../../../../utils/competencyMapping';
import { CompetencyMetrics } from './CompetencyMetrics';
import { CompetencyPanel } from './CompetencyPanel';
import { WeaknessPanel } from './WeaknessPanel';

interface AnalyticsPanelProps {
    reportRef: RefObject<HTMLDivElement | null>;
    studentName: string;
    studentClass: string;
    competencyData: CompetencyData[];
    weaknessProfile: WeaknessProfileResponse | null;
    focusSkills: SkillBreakdownItem[];
    isWeaknessLoading: boolean;
    weaknessError: string | null;
    showCoverageWarning: boolean;
    smartPreview: SmartAssignmentPreviewData | null;
    smartPreviewError: string | null;
    smartPreviewErrorDetails: SmartAssignmentPreviewApiResponse['data'] | null;
    isSmartPreviewLoading: boolean;
    selectedPreviewQuizId: string;
    smartDeadline: string;
    smartMaxAttempts: number;
    aiInsight: string | null;
    isAnalyzing: boolean;
    analysisError: string | null;
    onLoadSmartPreview: () => void;
    onPreviewQuizChange: (value: string) => void;
    onDeadlineChange: (value: string) => void;
    onMaxAttemptsChange: (value: number) => void;
    onUseSmartPreview: () => void;
    onAnalyze: () => void;
}

export const AnalyticsPanel: React.FC<AnalyticsPanelProps> = (props) => (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50 custom-scrollbar">
        <div ref={props.reportRef} className="max-w-4xl mx-auto space-y-8 animate-in slide-in-from-bottom duration-500 p-4">
            <div className="hidden pdf-only flex items-center justify-between mb-8 pb-4 border-b-2 border-blue-600">
                <h1 className="text-2xl font-black text-slate-800">Báo Cáo Năng Lực Học Sinh</h1>
                <p className="text-sm text-slate-500 font-bold">{props.studentName} • {props.studentClass}</p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                <CompetencyPanel data={props.competencyData} studentName={props.studentName} />
                <div className="lg:col-span-2 space-y-6">
                    <CompetencyMetrics data={props.competencyData} />
                    <WeaknessPanel
                        profile={props.weaknessProfile}
                        focusSkills={props.focusSkills}
                        isLoading={props.isWeaknessLoading}
                        error={props.weaknessError}
                        showCoverageWarning={props.showCoverageWarning}
                        studentName={props.studentName}
                        smartPreview={props.smartPreview}
                        smartPreviewError={props.smartPreviewError}
                        smartPreviewErrorDetails={props.smartPreviewErrorDetails}
                        isSmartPreviewLoading={props.isSmartPreviewLoading}
                        selectedPreviewQuizId={props.selectedPreviewQuizId}
                        smartDeadline={props.smartDeadline}
                        smartMaxAttempts={props.smartMaxAttempts}
                        onLoadSmartPreview={props.onLoadSmartPreview}
                        onPreviewQuizChange={props.onPreviewQuizChange}
                        onDeadlineChange={props.onDeadlineChange}
                        onMaxAttemptsChange={props.onMaxAttemptsChange}
                        onUseSmartPreview={props.onUseSmartPreview}
                    />
                    <AIInsightBox
                        insight={props.aiInsight}
                        isLoading={props.isAnalyzing}
                        onAnalyze={props.onAnalyze}
                        error={props.analysisError}
                    />
                </div>
            </div>
        </div>
    </div>
);
