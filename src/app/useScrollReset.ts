import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router';

/**
 * Client-side navigation keeps the window scroll position, so opening a subject page from the
 * middle of the student dashboard used to render it mid-page with the sticky header above the
 * viewport (measured 2026-07-26: scrollY 1371, h1 at top -324 on a 375px viewport).
 *
 * React Router's own <ScrollRestoration/> is not an option here: it requires a data router and
 * index.tsx mounts a plain <BrowserRouter>. So this hook does the same job by hand — reset to the
 * top on PUSH/REPLACE, and restore the saved offset on POP so Back/Forward keep working.
 */

const STORAGE_KEY = 'quizpro:scroll-positions';
const MAX_ENTRIES = 50;
// Measured on 2026-07-27: both dev and production normally become scrollable in ~35 ms and
// settle near 66 ms. Keep a generous wall-clock deadline for cold lazy chunks without tying the
// behavior to refresh rate or an arbitrary number of paints. User input still cancels immediately.
const MAX_RESTORE_DURATION_MS = 2_000;
/** `scroll` is deliberately absent: our own window.scrollTo() fires it and would self-cancel. */
const USER_SCROLL_EVENTS = ['wheel', 'touchstart', 'keydown'] as const;

type PositionMap = Map<string, number>;

const readStoredPositions = (): PositionMap => {
    try {
        const raw = window.sessionStorage.getItem(STORAGE_KEY);
        const parsed: unknown = raw ? JSON.parse(raw) : null;
        if (!Array.isArray(parsed)) return new Map();
        return new Map(
            parsed.filter(
                (entry): entry is [string, number] =>
                    Array.isArray(entry) && typeof entry[0] === 'string' && typeof entry[1] === 'number',
            ),
        );
    } catch {
        return new Map();
    }
};

const writeStoredPositions = (positions: PositionMap) => {
    try {
        const entries = Array.from(positions).slice(-MAX_ENTRIES);
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {
        // sessionStorage can be unavailable (private mode) or full — scroll memory is not worth throwing over.
    }
};

/**
 * Scrolls back to `target`, retrying across a bounded number of frames because lazy routes render
 * <PageLoading/> first and the document is not tall enough to reach the offset yet. Gives up as
 * soon as the user scrolls themselves, so we never fight them for control of the page.
 */
const restoreScrollTo = (target: number, onSettled: () => void) => {
    let startedAt: number | null = null;
    let rafId = 0;
    let settled = false;

    const stop = () => {
        if (settled) return;
        settled = true;
        cancelAnimationFrame(rafId);
        USER_SCROLL_EVENTS.forEach(name => window.removeEventListener(name, stop));
        onSettled();
    };

    const step = (timestamp: number) => {
        if (settled) return;
        if (startedAt === null) startedAt = timestamp;

        // Browsers clamp this call while the lazy route is shorter than `target`. Retrying until the
        // observed scroll position reaches the saved offset makes document growth the success signal.
        window.scrollTo(0, target);
        const restored = window.scrollY >= target - 1;
        const expired = timestamp - startedAt >= MAX_RESTORE_DURATION_MS;
        if (restored || expired) {
            stop();
            return;
        }
        rafId = requestAnimationFrame(step);
    };

    USER_SCROLL_EVENTS.forEach(name => window.addEventListener(name, stop, { passive: true }));
    rafId = requestAnimationFrame(step);
    return stop;
};

/**
 * @param view Optional store-driven screen key. RootView and StudentDashboardUI swap whole screens
 * without changing the URL (e.g. starting a practice quiz from SubjectLibrary), so useLocation
 * alone cannot see those transitions.
 */
export const useScrollReset = (view?: string) => {
    const location = useLocation();
    const navigationType = useNavigationType();

    const positionsRef = useRef<PositionMap | null>(null);
    const activeKeyRef = useRef(location.key);
    const previousPathnameRef = useRef<string | null>(null);
    const previousViewRef = useRef(view);
    const restoringKeyRef = useRef<string | null>(null);
    const cancelRestoreRef = useRef<() => void>(() => {});

    if (positionsRef.current === null) positionsRef.current = readStoredPositions();

    useEffect(() => {
        const history = window.history;
        const previousRestoration = history.scrollRestoration;
        if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

        const positions = positionsRef.current!;
        // Recorded on every scroll rather than read at navigation time: by the time the location
        // effect runs the new screen has rendered and the browser may already have clamped scrollY
        // to a shorter document, losing the offset we wanted to remember.
        const handleScroll = () => {
            const key = activeKeyRef.current;
            const nextPosition = window.scrollY;
            const savedPosition = positions.get(key);
            const documentHeight = Math.max(
                document.documentElement.scrollHeight,
                document.body?.scrollHeight ?? 0,
            );
            const maxReachablePosition = Math.max(0, documentHeight - window.innerHeight);
            const clampedByShortDocument = typeof savedPosition === 'number'
                && nextPosition < savedPosition
                && maxReachablePosition < savedPosition - 1;

            // A lazy fallback can collapse the outgoing document before React commits the new
            // location. Browsers clamp scrollY and emit `scroll` while activeKeyRef still points at
            // the page being left. Preserve its last reachable offset instead of replacing it with
            // that synthetic clamp; real upward scrolling remains recordable while the page is tall.
            if (!clampedByShortDocument) positions.set(key, nextPosition);
        };
        const handlePageHide = () => writeStoredPositions(positions);

        window.addEventListener('scroll', handleScroll, { passive: true });
        window.addEventListener('pagehide', handlePageHide);

        return () => {
            window.removeEventListener('scroll', handleScroll);
            window.removeEventListener('pagehide', handlePageHide);
            writeStoredPositions(positions);
            if ('scrollRestoration' in history) history.scrollRestoration = previousRestoration;
        };
    }, []);

    // Layout effect, not effect: this runs before paint, so the new screen is never shown at the
    // old offset for a frame before snapping.
    useLayoutEffect(() => {
        const positions = positionsRef.current!;
        const isFirstRender = previousPathnameRef.current === null;
        const pathnameChanged = previousPathnameRef.current !== location.pathname;

        previousPathnameRef.current = location.pathname;
        activeKeyRef.current = location.key;

        // A search- or hash-only change (?quizId=, ?quiz=) is not a new page — leave scroll alone.
        if (!pathnameChanged) return;
        if ((location.state as { preventScrollReset?: boolean } | null)?.preventScrollReset) return;

        cancelRestoreRef.current();

        // On a reload the browser keeps history.state, so location.key still matches what we saved
        // before — restoring here replaces the native reload restore we turned off above.
        if (isFirstRender || navigationType === 'POP') {
            const target = positions.get(location.key);
            if (typeof target !== 'number' || target <= 0) return;
            restoringKeyRef.current = location.key;
            cancelRestoreRef.current = restoreScrollTo(target, () => {
                restoringKeyRef.current = null;
            });
            return;
        }

        // A hash means the caller asked for a specific place on the new page, not the top of it.
        const anchor = location.hash
            ? document.getElementById(decodeURIComponent(location.hash.slice(1)))
            : null;
        if (anchor) anchor.scrollIntoView({ block: 'start' });
        else window.scrollTo(0, 0);
    }, [location, navigationType]);

    useLayoutEffect(() => {
        if (previousViewRef.current === view) return;
        previousViewRef.current = view;
        // A POP restore for this location owns the scroll position; a view change triggered by the
        // same navigation (useQuizUrlSelection reading ?quiz=) must not stomp on it.
        if (restoringKeyRef.current === location.key) return;
        cancelRestoreRef.current();
        window.scrollTo(0, 0);
    }, [view, location.key]);
};
