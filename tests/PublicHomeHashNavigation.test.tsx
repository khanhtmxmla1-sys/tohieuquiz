import React, { useLayoutEffect } from 'react';
import { act, render } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate, type InitialEntry, type NavigateFunction } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useScrollReset } from '../src/app/useScrollReset';
import { usePublicHomeHashNavigation } from '../src/features/public-home/usePublicHomeHashNavigation';

const SCROLL_POSITIONS_KEY = 'quizpro:scroll-positions';

let frameQueue: FrameRequestCallback[];
let navigate: NavigateFunction;
let historyEntryId = 0;
let scrollIntoView: ReturnType<typeof vi.fn>;
let originalScrollIntoView: typeof Element.prototype.scrollIntoView | undefined;

interface HarnessProps {
    seedPosition?: number;
    showTarget?: boolean;
}

const Harness: React.FC<HarnessProps> = ({ seedPosition, showTarget = true }) => {
    const location = useLocation();
    navigate = useNavigate();

    // This runs before the hook's layout effect and models the position map that
    // useScrollReset persists for a history entry before a lazy remount.
    useLayoutEffect(() => {
        if (typeof seedPosition !== 'number') return;
        window.sessionStorage.setItem(
            SCROLL_POSITIONS_KEY,
            JSON.stringify([[location.key, seedPosition]]),
        );
    }, [location.key, seedPosition]);

    usePublicHomeHashNavigation();

    let sectionId = location.hash.slice(1);
    try {
        sectionId = decodeURIComponent(sectionId);
    } catch {
        // Keep malformed hashes from making the test harness throw before the hook can ignore them.
    }
    return showTarget && sectionId ? <div id={sectionId}>section</div> : null;
};

const withUniqueHistoryKeys = (initialEntries: InitialEntry[]): InitialEntry[] => initialEntries.map((entry) => {
    if (typeof entry !== 'string') return entry;
    const url = new URL(entry, 'https://test.invalid');
    return {
        pathname: url.pathname,
        search: url.search,
        hash: url.hash,
        key: `hash-test-${historyEntryId += 1}`,
    };
});

const renderHarness = (initialEntries: InitialEntry[], props: HarnessProps = {}, initialIndex?: number) =>
    render(
        <MemoryRouter initialEntries={withUniqueHistoryKeys(initialEntries)} initialIndex={initialIndex}>
            <Harness {...props} />
        </MemoryRouter>,
    );

const flushFrame = (timestamp = 16) => {
    const callback = frameQueue.shift();
    expect(callback).toBeDefined();
    act(() => callback?.(timestamp));
};

const flushFrames = () => {
    let timestamp = 16;
    while (frameQueue.length > 0 && timestamp <= 2_100) {
        const callback = frameQueue.shift();
        act(() => callback?.(timestamp));
        timestamp += 16;
    }
};

const setScrollY = (value: number) => {
    Object.defineProperty(window, 'scrollY', { value, configurable: true, writable: true });
};

const LiveLanding = () => {
    const location = useLocation();
    usePublicHomeHashNavigation();
    const sectionId = location.hash.slice(1);
    return <div id={sectionId}>section</div>;
};

const LivePopHarness = () => {
    const location = useLocation();
    navigate = useNavigate();
    useScrollReset();
    return location.pathname === '/' ? <LiveLanding /> : <div>legal-page</div>;
};

beforeEach(() => {
    window.sessionStorage.clear();
    frameQueue = [];
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
        frameQueue.push(callback);
        return frameQueue.length;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    originalScrollIntoView = Element.prototype.scrollIntoView;
    scrollIntoView = vi.fn();
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
        configurable: true,
        value: scrollIntoView,
    });
});

afterEach(() => {
    if (originalScrollIntoView) {
        Object.defineProperty(Element.prototype, 'scrollIntoView', {
            configurable: true,
            value: originalScrollIntoView,
        });
    } else {
        delete (Element.prototype as Partial<Element>).scrollIntoView;
    }
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('usePublicHomeHashNavigation', () => {
    it('resolves a direct hash after the lazy section appears', () => {
        const view = renderHarness(['/#tinh-nang'], { showTarget: false });
        expect(frameQueue).toHaveLength(1);

        view.rerender(
            <MemoryRouter initialEntries={['/#tinh-nang']}>
                <Harness showTarget />
            </MemoryRouter>,
        );
        flushFrame();

        expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start' });
        expect(window.sessionStorage.getItem(SCROLL_POSITIONS_KEY)).toBeNull();
    });

    it('resolves a fresh direct hash under StrictMode', () => {
        render(
            <React.StrictMode>
                <MemoryRouter initialEntries={withUniqueHistoryKeys(['/#tinh-nang'])}>
                    <Harness />
                </MemoryRouter>
            </React.StrictMode>,
        );

        flushFrames();

        expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start' });
    });

    it('resolves an in-page PUSH hash without changing the app scroll hook', () => {
        renderHarness(['/']);

        act(() => { navigate('/#bat-dau'); });
        flushFrame();

        expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start' });
    });

    it('keeps a saved POP/reload position instead of taking the hash anchor', () => {
        renderHarness(['/#tinh-nang'], { seedPosition: 1371 });

        expect(frameQueue).toHaveLength(0);
        expect(scrollIntoView).not.toHaveBeenCalled();
        expect(window.sessionStorage.getItem(SCROLL_POSITIONS_KEY)).toEqual(
            expect.stringContaining('1371'),
        );
    });

    it('accepts encoded valid section ids but ignores unknown and malformed hashes', () => {
        const encoded = renderHarness(['/#tinh%2Dnang']);
        flushFrame();
        expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start' });
        encoded.unmount();

        scrollIntoView.mockClear();
        renderHarness(['/#not-a-landing-section']);
        expect(frameQueue).toHaveLength(0);
        expect(scrollIntoView).not.toHaveBeenCalled();

        scrollIntoView.mockClear();
        renderHarness(['/#Tinh-Nang']);
        expect(frameQueue).toHaveLength(0);
        expect(scrollIntoView).not.toHaveBeenCalled();

        scrollIntoView.mockClear();
        renderHarness(['/#%E0%A4%A']);
        expect(frameQueue).toHaveLength(0);
        expect(scrollIntoView).not.toHaveBeenCalled();
    });

    it.each(['wheel', 'touchstart', 'keydown', 'focusin'])('cancels a pending hash scroll on %s', (eventName) => {
        const view = renderHarness(['/#tinh-nang'], { showTarget: false });

        act(() => { window.dispatchEvent(new Event(eventName)); });
        view.rerender(
            <MemoryRouter initialEntries={['/#tinh-nang']}>
                <Harness showTarget />
            </MemoryRouter>,
        );
        flushFrame();

        expect(scrollIntoView).not.toHaveBeenCalled();
    });

    it('cleans up a pending hash scroll on unmount without stealing focus', () => {
        const view = renderHarness(['/#tinh-nang'], { showTarget: false });
        const activeElement = document.activeElement;

        view.unmount();
        flushFrame();

        expect(scrollIntoView).not.toHaveBeenCalled();
        expect(document.activeElement).toBe(activeElement);
    });

    it.each([
        { hash: '#tinh-nang', offset: 0 },
        { hash: '#tinh-nang', offset: 1371 },
        { hash: '#top', offset: 0 },
        { hash: '#top', offset: 1371 },
    ])('does not steal same-SPA POP restore without storage ($hash at $offset)', ({ hash, offset }) => {
        const view = render(
            <MemoryRouter
                initialEntries={withUniqueHistoryKeys(['/__seed', `/${hash}`, '/legal'])}
                initialIndex={1}
            >
                <LivePopHarness />
            </MemoryRouter>,
        );
        flushFrames();
        scrollIntoView.mockClear();
        window.sessionStorage.clear();

        setScrollY(offset);
        act(() => { window.dispatchEvent(new Event('scroll')); });
        act(() => { navigate('/legal'); });
        act(() => { navigate(-1); });
        expect(window.sessionStorage.getItem(SCROLL_POSITIONS_KEY)).toBeNull();

        flushFrames();

        expect(scrollIntoView).not.toHaveBeenCalled();
        view.unmount();
    });

    it('resolves a mounted POP hash after a StrictMode SPA remount', () => {
        const view = render(
            <React.StrictMode>
                <MemoryRouter
                    initialEntries={withUniqueHistoryKeys(['/__seed', '/#tinh-nang', '/legal'])}
                    initialIndex={1}
                >
                    <LivePopHarness />
                </MemoryRouter>
            </React.StrictMode>,
        );
        flushFrames();
        scrollIntoView.mockClear();
        window.sessionStorage.clear();

        act(() => { navigate('/legal'); });
        act(() => { navigate(-1); });
        flushFrames();
        scrollIntoView.mockClear();

        act(() => { navigate('/#bat-dau'); });
        flushFrames();
        scrollIntoView.mockClear();

        act(() => { navigate(-1); });
        flushFrames();

        expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start' });
        view.unmount();
    });

    it.each([
        { hash: '#tinh-nang', offset: 0 },
        { hash: '#tinh-nang', offset: 1371 },
        { hash: '#top', offset: 0 },
        { hash: '#top', offset: 1371 },
    ])('does not steal same-SPA POP restore under StrictMode with empty storage ($hash at $offset)', ({ hash, offset }) => {
        const view = render(
            <React.StrictMode>
                <MemoryRouter
                    initialEntries={withUniqueHistoryKeys(['/__seed', `/${hash}`, '/legal'])}
                    initialIndex={1}
                >
                    <LivePopHarness />
                </MemoryRouter>
            </React.StrictMode>,
        );
        flushFrames();
        scrollIntoView.mockClear();
        window.sessionStorage.clear();

        setScrollY(offset);
        act(() => { window.dispatchEvent(new Event('scroll')); });
        act(() => { navigate('/legal'); });
        act(() => { navigate(-1); });
        expect(window.sessionStorage.getItem(SCROLL_POSITIONS_KEY)).toBeNull();

        flushFrames();

        expect(scrollIntoView).not.toHaveBeenCalled();
        view.unmount();
    });
});
