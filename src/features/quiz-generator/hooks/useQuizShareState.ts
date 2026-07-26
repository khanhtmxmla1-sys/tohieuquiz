import { useState } from 'react';
import { showSuccess } from '../../../utils/toast';

export const useQuizShareState = () => {
    const [showLinkModal, setShowLinkModal] = useState(false);
    const [savedQuizLink, setSavedQuizLink] = useState('');
    const [linkCopied, setLinkCopied] = useState(false);

    const openSavedQuizLink = (quizId: string) => {
        setSavedQuizLink(`${window.location.origin}/?quiz=${quizId}`);
        setLinkCopied(false);
        setShowLinkModal(true);
    };

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(savedQuizLink);
            setLinkCopied(true);
            showSuccess('Đã sao chép link chia sẻ!');
            setTimeout(() => setLinkCopied(false), 3000);
        } catch {
            // Preserve the existing silent clipboard failure behavior.
        }
    };

    return {
        showLinkModal,
        setShowLinkModal,
        savedQuizLink,
        linkCopied,
        openSavedQuizLink,
        handleCopyLink,
    };
};
