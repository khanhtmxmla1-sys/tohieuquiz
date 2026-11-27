import { useCallback, useState, type MutableRefObject } from 'react';
import type { Quiz } from '../../../types';
import { requestQuizAccess } from '../../../services/quizAccessService';

type AccessStep = 'info' | 'notice';

type QuizAssignmentId = NonNullable<Pick<Quiz, '_assignmentData'>['_assignmentData']>['id'];

interface UseQuizAccessProps {
    quizId: string;
    assignmentId?: QuizAssignmentId;
    isLoggedIn: boolean;
    accessGrantRef: MutableRefObject<string | null>;
    setStep: (step: AccessStep) => void;
}

export const useQuizAccess = ({
    quizId,
    assignmentId,
    isLoggedIn,
    accessGrantRef,
    setStep,
}: UseQuizAccessProps) => {
    const [enteredCode, setEnteredCode] = useState('');
    const [codeError, setCodeError] = useState('');
    const [isVerifyingCode, setIsVerifyingCode] = useState(false);

    const handleCodeVerify = useCallback(async () => {
        if (isVerifyingCode) return;
        setIsVerifyingCode(true);
        setCodeError('');
        try {
            const normalizedAssignmentId = assignmentId ? String(assignmentId) : undefined;
            const access = await requestQuizAccess(quizId, enteredCode, normalizedAssignmentId);
            if (access.valid) {
                accessGrantRef.current = access.accessGrant || null;
                setStep(isLoggedIn ? 'notice' : 'info');
            } else setCodeError('Mã không đúng. Vui lòng thử lại!');
        } catch {
            setCodeError('Không thể kiểm tra mã lúc này. Vui lòng thử lại.');
        } finally {
            setIsVerifyingCode(false);
        }
    }, [accessGrantRef, assignmentId, enteredCode, isLoggedIn, isVerifyingCode, quizId, setStep]);

    return {
        enteredCode,
        setEnteredCode,
        codeError,
        isVerifyingCode,
        handleCodeVerify,
    };
};
