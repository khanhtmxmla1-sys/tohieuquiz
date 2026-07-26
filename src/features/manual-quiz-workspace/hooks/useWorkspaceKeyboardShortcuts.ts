import { useEffect } from 'react';

interface WorkspaceKeyboardShortcutOptions {
    enabled?: boolean;
    onSaveDraft?: () => void;
    onSaveQuestionAndNext?: () => void;
    onMoveQuestion?: (offset: -1 | 1) => void;
    onEscape?: () => void;
}

const isImeEvent = (event: KeyboardEvent): boolean => event.isComposing || event.keyCode === 229;

export const useWorkspaceKeyboardShortcuts = ({
    enabled = true,
    onSaveDraft,
    onSaveQuestionAndNext,
    onMoveQuestion,
    onEscape,
}: WorkspaceKeyboardShortcutOptions): void => {
    useEffect(() => {
        if (!enabled) return undefined;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.defaultPrevented || isImeEvent(event)) return;
            const commandKey = event.ctrlKey || event.metaKey;

            if (commandKey && event.key.toLowerCase() === 's' && onSaveDraft) {
                event.preventDefault();
                onSaveDraft();
                return;
            }
            if (commandKey && event.key === 'Enter' && onSaveQuestionAndNext) {
                event.preventDefault();
                onSaveQuestionAndNext();
                return;
            }
            if (event.altKey && event.key === 'ArrowUp' && onMoveQuestion) {
                event.preventDefault();
                onMoveQuestion(-1);
                return;
            }
            if (event.altKey && event.key === 'ArrowDown' && onMoveQuestion) {
                event.preventDefault();
                onMoveQuestion(1);
                return;
            }
            if (event.key === 'Escape' && onEscape) {
                event.preventDefault();
                onEscape();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [enabled, onEscape, onMoveQuestion, onSaveDraft, onSaveQuestionAndNext]);
};
