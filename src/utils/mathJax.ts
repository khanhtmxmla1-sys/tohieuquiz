/**
 * MathJax Utility
 * 
 * Provides a safe way to trigger MathJax typesetting on specific elements.
 * Works with better-react-mathjax and vanilla MathJax.
 */

declare global {
    interface Window {
        MathJax: any;
    }
}

/**
 * Force MathJax to typeset a specific element or the whole page.
 * @param element The DOM element to typeset. If null/undefined, typesets the whole page.
 */
export const renderMathJax = (element?: HTMLElement | null): void => {
    if (typeof window === 'undefined' || !window.MathJax) return;

    try {
        // MathJax 3.x uses promise-based API
        if (window.MathJax.typesetPromise) {
            if (element) {
                window.MathJax.typesetPromise([element]).catch((err: any) => 
                    console.error('MathJax typeset failed:', err)
                );
            } else {
                window.MathJax.typesetPromise().catch((err: any) => 
                    console.error('MathJax typeset failed:', err)
                );
            }
        } 
        // Fallback for MathJax 2.x
        else if (window.MathJax.Hub && window.MathJax.Hub.Queue) {
            window.MathJax.Hub.Queue(["Typeset", window.MathJax.Hub, element]);
        }
    } catch (error) {
        console.warn('MathJax rendering error:', error);
    }
};
