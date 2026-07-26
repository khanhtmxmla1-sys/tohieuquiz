import { useEffect, type RefObject } from 'react';

const FOCUSABLE_SELECTOR = [
    'button:not([disabled])',
    'a[href]',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
].join(',');

interface DialogFocusTrapOptions {
    open: boolean;
    containerRef: RefObject<HTMLElement | null>;
    initialFocusRef?: RefObject<HTMLElement | null>;
    onEscape?: () => void;
}

export const useDialogFocusTrap = ({
    open,
    containerRef,
    initialFocusRef,
    onEscape,
}: DialogFocusTrapOptions): void => {
    useEffect(() => {
        if (!open) return undefined;
        const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const container = containerRef.current;
        const focusables = () => Array.from(
            container?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? [],
        ).filter((element) => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true');

        const initial = initialFocusRef?.current ?? focusables()[0] ?? container;
        initial?.focus();

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && onEscape) {
                event.preventDefault();
                event.stopImmediatePropagation();
                onEscape();
                return;
            }
            if (event.key !== 'Tab') return;
            const items = focusables();
            if (items.length === 0) {
                event.preventDefault();
                container?.focus();
                return;
            }
            const first = items[0];
            const last = items[items.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };

        window.addEventListener('keydown', handleKeyDown, true);
        return () => {
            window.removeEventListener('keydown', handleKeyDown, true);
            window.setTimeout(() => returnFocus?.focus(), 0);
        };
    }, [containerRef, initialFocusRef, onEscape, open]);
};
