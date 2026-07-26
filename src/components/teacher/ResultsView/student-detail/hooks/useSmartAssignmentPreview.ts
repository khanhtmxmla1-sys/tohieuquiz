import { useEffect, useState } from 'react';
import type { SmartAssignmentPreviewApiResponse, SmartAssignmentPreviewData } from '../../../../../types/classroom.types';
import type { StudentResult } from '../../../../../types';
import { getSmartAssignmentPreview } from '../../../../../services/classroomService';
import { toast } from 'react-hot-toast';
import { createSmartAssignmentComposerDraft } from '../models/smartAssignmentDraft';
import { toVietnamDateTimeLocal } from '../../../../../utils/dateTime';

export const useSmartAssignmentPreview = (
    result: StudentResult,
    teacherUsername: string,
    openDraft: (draft: ReturnType<typeof createSmartAssignmentComposerDraft>) => void
) => {
    const [smartPreview, setSmartPreview] = useState<SmartAssignmentPreviewData | null>(null);
    const [smartPreviewError, setSmartPreviewError] = useState<string | null>(null);
    const [smartPreviewErrorDetails, setSmartPreviewErrorDetails] = useState<SmartAssignmentPreviewApiResponse['data'] | null>(null);
    const [isSmartPreviewLoading, setIsSmartPreviewLoading] = useState(false);
    const [selectedPreviewQuizId, setSelectedPreviewQuizId] = useState('');
    const [smartDeadline, setSmartDeadline] = useState('');
    const [smartMaxAttempts, setSmartMaxAttempts] = useState(1);

    useEffect(() => {
        setSmartPreview(null); setSmartPreviewError(null); setSmartPreviewErrorDetails(null);
        setSelectedPreviewQuizId(''); setSmartDeadline(''); setSmartMaxAttempts(1);
    }, [result.id]);
    useEffect(() => {
        if (!smartPreview) return;
        setSelectedPreviewQuizId(smartPreview.assignmentDraft.quizId);
        setSmartDeadline(toVietnamDateTimeLocal(smartPreview.assignmentDraft.deadline));
        setSmartMaxAttempts(smartPreview.assignmentDraft.maxAttempts);
    }, [smartPreview]);

    const handleLoadSmartPreview = async () => {
        if (!teacherUsername) {
            toast.error('Khong xac dinh duoc giao vien dang dang nhap.');
            return;
        }
        setIsSmartPreviewLoading(true); setSmartPreviewError(null); setSmartPreviewErrorDetails(null);
        try {
            const response = await getSmartAssignmentPreview({
                resultId: String(result.id), teacherUsername,
                strategy: 'top_weak_skill', deadlinePreset: '7d', maxAttempts: 1,
            });
            if (response.status === 'success' && response.data && 'assignmentDraft' in response.data) {
                setSmartPreview(response.data); return;
            }
            setSmartPreview(null); setSmartPreviewError(response.message || 'Khong tao duoc smart preview.');
            setSmartPreviewErrorDetails(response.data || null);
        } catch (error) {
            const normalized = error instanceof Error ? error : new Error(String(error));
            setSmartPreview(null); setSmartPreviewError(normalized.message || 'Khong tao duoc smart preview.');
            setSmartPreviewErrorDetails(null);
        } finally { setIsSmartPreviewLoading(false); }
    };

    const handleUseSmartPreviewInAssignmentTab = () => {
        if (!smartPreview || !selectedPreviewQuizId || !smartDeadline) {
            toast.error('Smart preview chua san sang de giao bai.'); return;
        }
        const selected = smartPreview.recommendedQuizzes.find(({ quizId }) => quizId === selectedPreviewQuizId);
        openDraft(createSmartAssignmentComposerDraft(
            result.id, smartPreview, selectedPreviewQuizId, smartDeadline, smartMaxAttempts
        ));
        toast.success(selected
            ? `Da nap goi y "${selected.title}" sang tab Giao bai.`
            : 'Da nap smart preview sang tab Giao bai.');
    };

    return {
        smartPreview, smartPreviewError, smartPreviewErrorDetails, isSmartPreviewLoading,
        selectedPreviewQuizId, setSelectedPreviewQuizId,
        smartDeadline, setSmartDeadline, smartMaxAttempts, setSmartMaxAttempts,
        handleLoadSmartPreview, handleUseSmartPreviewInAssignmentTab,
    };
};
