import { useEffect, useState } from 'react';
import type { WeaknessProfileResponse } from '../../../../../shared/skillTaxonomy';
import { fetchWeaknessProfile } from '../../../../../services/weaknessProfileService';

export const useWeaknessProfile = (resultId: string | number, active: boolean) => {
    const [profile, setProfile] = useState<WeaknessProfileResponse | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setProfile(null);
        setError(null);
    }, [resultId]);

    useEffect(() => {
        let cancelled = false;
        if (!active || isLoading || profile) return () => { cancelled = true; };

        const load = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const response = await fetchWeaknessProfile(resultId);
                if (!cancelled) setProfile(response);
            } catch (unknownError) {
                if (cancelled) return;
                const normalized = unknownError instanceof Error
                    ? unknownError
                    : new Error(String(unknownError));
                setError(normalized.message.includes('404')
                    ? 'Chưa có dữ liệu phân tích năng lực cho bài này.'
                    : normalized.message || 'Khong the tai ho so diem yeu.');
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };
        void load();
        return () => { cancelled = true; };
    }, [active, resultId, isLoading, profile]);

    return { weaknessProfile: profile, isWeaknessLoading: isLoading, weaknessError: error };
};
