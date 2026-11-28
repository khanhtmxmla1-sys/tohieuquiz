import { useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router';

const SCROLL_POSITIONS_KEY = 'quizpro:scroll-positions';
const MAX_HASH_NAVIGATION_MS = 2_000;
const MAX_SEEN_LANDING_KEYS = 50;
// useScrollReset intentionally keeps live SPA positions in memory until pagehide.
// Remember the landing history entries we mounted so a same-SPA POP can defer to
// the in-memory restore even though the local hook cannot read its private map.
const seenLandingHistoryEntries = new Set<string>();
const LANDING_SECTION_IDS = new Set([
    'top',
    'doi-tuong',
    'tinh-nang',
    'loi-ich',
    'trang-nguyen',
    'so-lieu',
    'bat-dau',
]);

const readSavedPosition = (locationKey: string): number | null => {
    try {
        const raw = window.sessionStorage.getItem(SCROLL_POSITIONS_KEY);
        const parsed: unknown = raw ? JSON.parse(raw) : null;
        if (!Array.isArray(parsed)) return null;

        const entry = parsed.find(
            (candidate): candidate is [string, number] => (
                Array.isArray(candidate)
                && candidate[0] === locationKey
                && typeof candidate[1] === 'number'
                && Number.isFinite(candidate[1])
            ),
        );
        return entry?.[1] ?? null;
    } catch {
        return null;
    }
};

const decodeLandingHash = (hash: string): string | null => {
    if (!hash.startsWith('#') || hash.length <= 1) return null;

    try {
        const sectionId = decodeURIComponent(hash.slice(1));
        return LANDING_SECTION_IDS.has(sectionId) ? sectionId : null;
    } catch {
        return null;
    }
};

const markLandingHistoryEntry = (locationKey: string, hash: string) => {
    const entry = JSON.stringify([locationKey, hash]);
    const wasSeen = seenLandingHistoryEntries.has(entry);
    seenLandingHistoryEntries.add(entry);
    if (seenLandingHistoryEntries.size > MAX_SEEN_LANDING_KEYS) {
        const oldestEntry = seenLandingHistoryEntries.values().next().value;
        if (oldestEntry !== undefined) seenLandingHistoryEntries.delete(oldestEntry);
    }
    return wasSeen;
};

/**
 * Resolves landing-page anchors after the lazy page has mounted.
 *
 * The app-level scroll hook owns history positions. This hook only resolves a
 * whitelisted landing hash once its section exists, and leaves a saved positive
 * position authoritative for a POP/reload. That prevents a lazy landing chunk
 * from racing the existing bounded history restore.
 */
export const usePublicHomeHashNavigation = () => {
    const location = useLocation();
    const navigationType = useNavigationType();
    const previousLocationRef = useRef<{ key: string; hash: string } | null>(null);
    const firstEntryPopDecisionRef = useRef<{
        key: string;
        hash: string;
        shouldDefer: boolean;
    } | null>(null);

    useLayoutEffect(() => {
        const previousLocation = previousLocationRef.current;
        const isFirstEffectForLocation = previousLocation === null;
        previousLocationRef.current = { key: location.key, hash: location.hash };
        const wasSeenBeforeMount = markLandingHistoryEntry(location.key, location.hash);

        const sectionId = decodeLandingHash(location.hash);
        if (!sectionId) return;

        // A hash changed while this landing instance stayed mounted (for example,
        // a native in-page anchor) is an explicit user navigation. A same-SPA POP
        // remount is distinguished by the module-level history-entry set below;
        // a full reload starts with an empty set and falls back to sessionStorage.
        const hashChangedInMountedLanding = !isFirstEffectForLocation
            && (previousLocation.key !== location.key || previousLocation.hash !== location.hash);
        if (isFirstEffectForLocation) {
            firstEntryPopDecisionRef.current = {
                key: location.key,
                hash: location.hash,
                shouldDefer: navigationType === 'POP' && wasSeenBeforeMount,
            };
        }
        const isSameEntryReplay = firstEntryPopDecisionRef.current?.key === location.key
            && firstEntryPopDecisionRef.current.hash === location.hash;
        const isSameSpaPopRemount = navigationType === 'POP'
            && !hashChangedInMountedLanding
            && isSameEntryReplay
            && firstEntryPopDecisionRef.current?.shouldDefer === true;
        const hasSavedPosition = (readSavedPosition(location.key) ?? 0) > 0;
        const shouldResolveHash = !isSameSpaPopRemount && (
            navigationType !== 'POP'
            || hashChangedInMountedLanding
            || !hasSavedPosition
        );
        if (!shouldResolveHash) return;

        let rafId: number | null = null;
        let startedAt: number | null = null;
        let cancelled = false;

        const cancel = () => {
            if (cancelled) return;
            cancelled = true;
            if (rafId !== null) cancelAnimationFrame(rafId);
            window.removeEventListener('wheel', cancel);
            window.removeEventListener('touchstart', cancel);
            window.removeEventListener('keydown', cancel);
            window.removeEventListener('focusin', cancel);
        };

        const findAndScroll = (timestamp: number) => {
            if (cancelled) return;
            if (startedAt === null) startedAt = timestamp;

            const target = document.getElementById(sectionId);
            if (target) {
                target.scrollIntoView({ block: 'start' });
                cancel();
                return;
            }

            if (timestamp - startedAt >= MAX_HASH_NAVIGATION_MS) {
                cancel();
                return;
            }
            rafId = requestAnimationFrame(findAndScroll);
        };

        for (const eventName of ['wheel', 'touchstart', 'keydown', 'focusin'] as const) {
            window.addEventListener(eventName, cancel, { passive: true });
        }
        rafId = requestAnimationFrame(findAndScroll);

        return cancel;
    }, [location.hash, location.key, navigationType]);
};
