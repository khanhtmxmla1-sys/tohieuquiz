import { useEffect, useRef } from 'react';
import { clearQuizAttemptDraft } from '../quizAttemptDraft';
import { showConfirm } from '../../../utils/toast';

interface UseQuizNavigationGuardProps {
    active: boolean;
    quizId: string;
    onExit: () => void;
}

export const useQuizNavigationGuard = ({
    active,
    quizId,
    onExit,
}: UseQuizNavigationGuardProps): void => {
    const navigationConfirmOpenRef = useRef(false);

    useEffect(() => {
        if (!active) return;
        const handlePopState = (e: PopStateEvent) => {
            e.preventDefault();
            if (navigationConfirmOpenRef.current) {
                window.history.pushState(null, '', window.location.href);
                return;
            }
            navigationConfirmOpenRef.current = true;
            void showConfirm({
                message: 'Bạn đang làm bài! Tiến độ đang được lưu trên thiết bị. Bạn có chắc muốn thoát?',
                confirmLabel: 'Thoát',
                cancelLabel: 'Tiếp tục làm bài',
                destructive: true,
            }).then((confirmed) => {
                navigationConfirmOpenRef.current = false;
                if (confirmed) {
                    clearQuizAttemptDraft(quizId);
                    onExit();
                } else {
                    window.history.pushState(null, '', window.location.href);
                }
            });
        };

        window.history.pushState(null, '', window.location.href);
        window.addEventListener('popstate', handlePopState);

        return () => {
            window.removeEventListener('popstate', handlePopState);
        };
    }, [active, onExit, quizId]);
};
