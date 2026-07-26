import React from 'react';
import type { SmartAssignmentPreviewApiResponse, SmartAssignmentPreviewData } from '../../../../../types/classroom.types';
import { SmartPreviewForm } from './SmartPreviewForm';

interface SmartAssignmentPanelProps {
    preview: SmartAssignmentPreviewData | null;
    error: string | null;
    errorDetails: SmartAssignmentPreviewApiResponse['data'] | null;
    isLoading: boolean;
    selectedQuizId: string;
    deadline: string;
    maxAttempts: number;
    onLoad: () => void;
    onQuizChange: (value: string) => void;
    onDeadlineChange: (value: string) => void;
    onMaxAttemptsChange: (value: number) => void;
    onUse: () => void;
}

export const SmartAssignmentPanel: React.FC<SmartAssignmentPanelProps> = (props) => (
    <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
                <p className="text-sm font-black text-slate-800">Smart Assignment MVP</p>
                <p className="mt-1 text-xs text-slate-500">
                    Preview bai on loi cho chinh hoc sinh nay, dua tren weakness profile hien tai.
                </p>
            </div>
            <button
                onClick={props.onLoad}
                disabled={props.isLoading}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors disabled:opacity-60"
            >
                {props.isLoading ? 'Dang tao preview...' : 'Giao bai on loi cho em nay'}
            </button>
        </div>
        {props.error && (
            <div className="mt-4 rounded-2xl border border-red-100 bg-white px-4 py-3 text-sm text-red-600">
                <p className="font-semibold">{props.error}</p>
                {props.errorDetails && 'candidates' in props.errorDetails
                    && Array.isArray(props.errorDetails.candidates)
                    && props.errorDetails.candidates.map((candidate) => (
                        <p key={candidate.id} className="mt-1 text-xs text-red-500">
                            {candidate.fullName} - {candidate.className}
                        </p>
                    ))}
            </div>
        )}
        {props.preview && (
            <SmartPreviewForm
                preview={props.preview}
                selectedQuizId={props.selectedQuizId}
                deadline={props.deadline}
                maxAttempts={props.maxAttempts}
                onQuizChange={props.onQuizChange}
                onDeadlineChange={props.onDeadlineChange}
                onMaxAttemptsChange={props.onMaxAttemptsChange}
                onUse={props.onUse}
            />
        )}
    </div>
);
