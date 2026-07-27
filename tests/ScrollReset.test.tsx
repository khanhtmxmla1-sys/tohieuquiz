import React from 'react';
import { act, render } from '@testing-library/react';
import { MemoryRouter, useNavigate, type NavigateFunction } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useScrollReset } from '../src/app/useScrollReset';

/**
 * jsdom never scrolls, so scrollY has to be forced and window.scrollTo asserted on directly.
 * requestAnimationFrame is stubbed synchronously to make the bounded restore loop deterministic.
 */
const setScrollY = (value: number) => {
    Object.defineProperty(window, 'scrollY', { value, configurable: true, writable: true });
};

let scrollTo: ReturnType<typeof vi.spyOn>;
let navigate: NavigateFunction;

const Probe: React.FC<{ view?: string }> = ({ view }) => {
    navigate = useNavigate();
    useScrollReset(view);
    return null;
};

const renderProbe = (view?: string) =>
    render(
        <MemoryRouter initialEntries={['/']}>
            <Probe view={view} />
        </MemoryRouter>,
    );

beforeEach(() => {
    window.sessionStorage.clear();
    setScrollY(0);
    scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    let frameTimestamp = 0;
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
        frameTimestamp += 16;
        callback(frameTimestamp);
        return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {});
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('useScrollReset', () => {
    it('leaves scroll alone on the first render', () => {
        renderProbe();

        expect(scrollTo).not.toHaveBeenCalled();
    });

    it('scrolls to the top when the pathname changes', () => {
        renderProbe();

        act(() => { navigate('/student/practice/toan'); });

        expect(scrollTo).toHaveBeenCalledWith(0, 0);
    });

    it('scrolls to the top on a replace navigation', () => {
        renderProbe();

        act(() => { navigate('/about', { replace: true }); });

        expect(scrollTo).toHaveBeenCalledWith(0, 0);
    });

    it('scrolls to the anchor when the new URL carries a hash', () => {
        const anchor = document.createElement('div');
        anchor.id = 'practice-library';
        anchor.scrollIntoView = vi.fn();
        document.body.appendChild(anchor);
        renderProbe();

        act(() => { navigate('/student/practice/toan#practice-library'); });

        expect(anchor.scrollIntoView).toHaveBeenCalledWith({ block: 'start' });
        expect(scrollTo).not.toHaveBeenCalled();
        anchor.remove();
    });

    it('falls back to the top when the hash points at nothing', () => {
        renderProbe();

        act(() => { navigate('/about#no-such-anchor'); });

        expect(scrollTo).toHaveBeenCalledWith(0, 0);
    });

    it('leaves scroll alone when only the query string changes', () => {
        renderProbe();

        act(() => { navigate('/?quiz=abc123'); });

        expect(scrollTo).not.toHaveBeenCalled();
    });

    it('leaves scroll alone when the navigation opts out', () => {
        renderProbe();

        act(() => { navigate('/about', { state: { preventScrollReset: true } }); });

        expect(scrollTo).not.toHaveBeenCalled();
    });

    it('restores the offset the page was left at when going Back', () => {
        renderProbe();

        setScrollY(1371);
        act(() => { window.dispatchEvent(new Event('scroll')); });
        act(() => { navigate('/student/practice/toan'); });
        scrollTo.mockClear();
        setScrollY(0);

        act(() => { navigate(-1); });

        expect(scrollTo).toHaveBeenCalledWith(0, 1371);
    });

    it('keeps restoring when a lazy page grows after the twentieth frame', () => {
        const frameQueue: FrameRequestCallback[] = [];
        vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
            frameQueue.push(callback);
            return frameQueue.length;
        });
        renderProbe();

        setScrollY(1371);
        act(() => { window.dispatchEvent(new Event('scroll')); });
        act(() => { navigate('/student/practice/toan'); });
        scrollTo.mockClear();
        setScrollY(0);

        act(() => { navigate(-1); });

        for (let frame = 1; frame <= 20; frame += 1) {
            const callback = frameQueue.shift();
            expect(callback, `restore frame ${frame}`).toBeDefined();
            act(() => { callback!(frame * 16); });
        }

        // A cold lazy route may still be one viewport tall here. The restore must remain alive until
        // the route has enough content rather than expiring solely because twenty paints elapsed.
        expect(frameQueue).toHaveLength(1);
        setScrollY(1371);
        const callback = frameQueue.shift();
        act(() => { callback!(21 * 16); });

        expect(scrollTo).toHaveBeenCalledTimes(21);
    });

    it('stops an unreachable restore at its time deadline', () => {
        const frameQueue: FrameRequestCallback[] = [];
        vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
            frameQueue.push(callback);
            return frameQueue.length;
        });
        renderProbe();

        setScrollY(1371);
        act(() => { window.dispatchEvent(new Event('scroll')); });
        act(() => { navigate('/student/practice/toan'); });
        scrollTo.mockClear();
        setScrollY(0);

        act(() => { navigate(-1); });

        for (const timestamp of [0, 500, 1000, 1500, 2000]) {
            const callback = frameQueue.shift();
            expect(callback).toBeDefined();
            act(() => { callback!(timestamp); });
        }

        expect(frameQueue).toHaveLength(0);
        expect(scrollTo).toHaveBeenCalledTimes(5);
    });

    it('stops restoring as soon as the user scrolls themselves', () => {
        renderProbe();

        setScrollY(1371);
        act(() => { window.dispatchEvent(new Event('scroll')); });
        act(() => { navigate('/student/practice/toan'); });
        setScrollY(0);
        vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
            window.dispatchEvent(new Event('wheel'));
            callback(0);
            return 1;
        });
        scrollTo.mockClear();

        act(() => { navigate(-1); });

        expect(scrollTo).not.toHaveBeenCalled();
    });

    it('scrolls to the top when the store view changes at the same URL', () => {
        const { rerender } = renderProbe('home');

        rerender(
            <MemoryRouter initialEntries={['/']}>
                <Probe view="student" />
            </MemoryRouter>,
        );

        expect(scrollTo).toHaveBeenCalledWith(0, 0);
    });

    it('ignores a view that was already persisted before the first render', () => {
        renderProbe('teacher_dash');

        expect(scrollTo).not.toHaveBeenCalled();
    });

    it('restores the saved offset after a reload of the same history entry', () => {
        const { unmount } = renderProbe();

        setScrollY(1371);
        act(() => { window.dispatchEvent(new Event('scroll')); });
        unmount();
        scrollTo.mockClear();
        setScrollY(0);

        // A reload keeps history.state, so the remounted app sees the same location key back.
        renderProbe();

        expect(scrollTo).toHaveBeenCalledWith(0, 1371);
    });
});
