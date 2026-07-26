import { useEffect, useState } from 'react';

const MOBILE_MAX_WIDTH = 767;
const TABLET_MAX_WIDTH = 1023;

const getViewportWidth = () => {
    if (typeof window === 'undefined') return 1280;
    return window.innerWidth || document.documentElement.clientWidth || 1280;
};

export interface ResponsiveLayoutState {
    width: number;
    isMobile: boolean;
    isTablet: boolean;
    isDesktop: boolean;
}

export const useResponsiveLayout = (): ResponsiveLayoutState => {
    const [width, setWidth] = useState<number>(getViewportWidth);

    useEffect(() => {
        let rafId = 0;

        const handleResize = () => {
            cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(() => {
                setWidth(getViewportWidth());
            });
        };

        window.addEventListener('resize', handleResize, { passive: true });
        window.addEventListener('orientationchange', handleResize, { passive: true });

        handleResize();

        return () => {
            cancelAnimationFrame(rafId);
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('orientationchange', handleResize);
        };
    }, []);

    return {
        width,
        isMobile: width <= MOBILE_MAX_WIDTH,
        isTablet: width > MOBILE_MAX_WIDTH && width <= TABLET_MAX_WIDTH,
        isDesktop: width > TABLET_MAX_WIDTH,
    };
};

export default useResponsiveLayout;
