import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';

export const useLegacyQuizQuery = () => {
    const location = useLocation();
    const navigate = useNavigate();

    useEffect(() => {
        if (location.pathname !== '/') return;

        const params = new URLSearchParams(location.search);
        const legacyQuizId = params.get('quiz');
        const canonicalQuizId = params.get('quizId');
        if (!legacyQuizId || canonicalQuizId) return;

        params.set('quizId', legacyQuizId);
        params.delete('quiz');
        navigate({ pathname: '/', search: `?${params.toString()}` }, { replace: true });
    }, [location.pathname, location.search, navigate]);
};
