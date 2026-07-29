import { useEffect } from 'react';

export function useBodyScrollLock(active: boolean): void {
    useEffect(() => {
        if (!active) return;
        const { body, documentElement } = document;
        const previousOverflow = body.style.overflow;
        const previousPaddingRight = body.style.paddingRight;
        const scrollbarWidth = Math.max(0, window.innerWidth - documentElement.clientWidth);
        body.style.overflow = 'hidden';
        if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;
        return () => {
            body.style.overflow = previousOverflow;
            body.style.paddingRight = previousPaddingRight;
        };
    }, [active]);
}
