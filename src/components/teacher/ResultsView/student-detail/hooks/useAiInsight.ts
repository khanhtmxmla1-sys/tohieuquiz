import { useState } from 'react';
import type { CompetencyData } from '../../../../../utils/competencyMapping';
import type { StudentResult } from '../../../../../types';
import { analyzeStudentPerformance } from '../../../../../services/ai/studentAnalysisService';
import { showError } from '@/src/utils/toast';

export const useAiInsight = (
    result: StudentResult,
    competencyData: CompetencyData[]
) => {
    const [aiInsight, setAiInsight] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisError, setAnalysisError] = useState<string | null>(null);

    const handleAnalyze = async () => {
        if (isAnalyzing) return;
        setIsAnalyzing(true);
        setAnalysisError(null);
        try {
            setAiInsight(await analyzeStudentPerformance(result, competencyData));
        } catch (error) {
            const normalized = error instanceof Error ? error : new Error(String(error));
            setAnalysisError(normalized.message || 'Có lỗi xảy ra khi gọi AI.');
            showError('AI đang bận, vui lòng thử lại sau.');
        } finally {
            setIsAnalyzing(false);
        }
    };

    return { aiInsight, isAnalyzing, analysisError, handleAnalyze };
};
