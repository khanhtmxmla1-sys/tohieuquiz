import { useEffect, type RefObject } from 'react';

const FOCUSABLE = [
    'a[href]', 'button:not([disabled])', 'input:not([disabled])', 'select:not([disabled])',
    'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])',
].join(',');

export function useFocusTrap(
    containerRef: RefObject<HTMLElement | null>,
    active: boolean,
    initialFocusRef?: RefObject<HTMLElement | null>,
): void {
    useEffect(() => {
        if (!active) return;
        const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const container = containerRef.current;
        if (!container) return;

        const focusInitial = () => {
            const target = initialFocusRef?.current || container.querySelector<HTMLElement>(FOCUSABLE) || container;
            target.focus();
        };
        const frame = window.requestAnimationFrame(focusInitial);

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Tab') return;
            const focusable = [...container.querySelectorAll<HTMLElement>(FOCUSABLE)]
                .filter(element => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true');
            if (focusable.length === 0) {
                event.preventDefault();
                container.focus();
                return;
            }
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };

        document.addEventListener('keydown', onKeyDown);
        return () => {
            window.cancelAnimationFrame(frame);
            document.removeEventListener('keydown', onKeyDown);
            previous?.focus();
        };
    }, [active, containerRef, initialFocusRef]);
}
