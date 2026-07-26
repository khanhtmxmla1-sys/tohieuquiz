/**
 * TikZJax Integration Hook
 * 
 * Custom hook to trigger TikZJax rendering for geometric illustrations.
 * MathJax logic has been migrated to better-react-mathjax.
 */
import { useEffect } from 'react';

declare global {
    interface Window {
        tikzjax?: boolean;
    }
}

/**
 * Ensures TikZJax is loaded.
 */
const ensureTikZJaxLoaded = (): Promise<void> => {
    return new Promise((resolve) => {
        if (window.tikzjax || document.getElementById('tikzjax-script')) {
            resolve();
            return;
        }

        // TikZJax requires fonts.css
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.type = 'text/css';
        link.href = 'https://tikzjax.com/v1/fonts.css';
        document.head.appendChild(link);

        // Create script tag
        const script = document.createElement('script');
        script.id = 'tikzjax-script';
        script.src = 'https://tikzjax.com/v1/tikzjax.js';
        script.async = true;

        script.onload = () => {
            window.tikzjax = true;
            resolve();
        };

        document.head.appendChild(script);
    });
};

/**
 * Hook to handle TikZJax initialization.
 */
export const useTikZJax = () => {
    useEffect(() => {
        ensureTikZJaxLoaded();
    }, []);
};
