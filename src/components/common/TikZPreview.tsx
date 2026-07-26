import React, { useEffect, useRef, useState } from 'react';
import { useTikZJax } from '../../hooks/useMathJax';

interface TikZPreviewProps {
    code: string;
    className?: string;
}

const TikZPreview: React.FC<TikZPreviewProps> = ({ code, className = '' }) => {
    // Ensure TikZJax is loaded
    useTikZJax();

    const containerRef = useRef<HTMLDivElement>(null);
    const [svgContent, setSvgContent] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!code) return;

        // TikZJax watches for script tags with type="text/tikz"
        // When we insert one, it should process it and replace it with an SVG.
        // However, React's virtual DOM might conflict with TikZJax's DOM manipulation.
        // So we use a ref to manually manage this part of the DOM.

        const processTikZ = async () => {
            if (containerRef.current) {
                containerRef.current.innerHTML = ''; // Clear previous

                const script = document.createElement('script');
                script.type = 'text/tikz';
                script.textContent = code;

                containerRef.current.appendChild(script);

                // If TikZJax is loaded, it might pick this up automatically via MutationObserver.
                // If not, we might need to manually trigger it if such API exists.
                // For now, we rely on the observer.
            }
        };

        processTikZ();
    }, [code]);

    return (
        <div
            ref={containerRef}
            className={`tikz-container flex justify-center overflow-hidden ${className}`}
            style={{ minHeight: '100px' }}
        >
            {/* SVG will be injected here by TikZJax */}
        </div>
    );
};

export default TikZPreview;
