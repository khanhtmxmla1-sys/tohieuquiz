import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate, useNavigationType, type NavigateFunction } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/app/AppRoutes';
import { useScrollReset } from '../src/app/useScrollReset';
import { useQuizStore } from '../stores/quizStore';

/**
 * The back controls on /privacy and /tos used to be navigate('/'), a fresh PUSH. useScrollReset
 * sends PUSH to the top of the page, so a reader who opened the policy from the home page footer
 * came back above the footer they left. Both destinations are '/', so the assertions read the
 * navigation type — that is the only thing that distinguishes a real Back from a new push.
 */

vi.mock('../src/components/HomePage/HomePage', () => ({ default: () => <div>home-page</div> }));
vi.mock('../src/components/common/Footer', () => ({ default: () => <div>footer</div> }));

const PAGES = [
    { name: 'PrivacyPolicy', path: '/privacy', bottomButton: 'Quay lại Trang chủ' },
    { name: 'TermsOfService', path: '/tos', bottomButton: 'Tôi đã hiểu và Đồng ý' },
] as const;

const originalQuizState = useQuizStore.getState();

let navigate: NavigateFunction;
let scrollTo: ReturnType<typeof vi.spyOn>;
let frames: FrameRequestCallback[];

const setScrollY = (value: number) => {
    Object.defineProperty(window, 'scrollY', { value, configurable: true, writable: true });
};

const Probe = () => {
    const location = useLocation();
    const navigationType = useNavigationType();
    navigate = useNavigate();
    return <div data-testid="probe">{`${location.pathname}|${navigationType}`}</div>;
};

/** Mirrors MainApp: the scroll hook watches the store view alongside the router location. */
const Harness = () => {
    const view = useQuizStore(state => state.view);
    useScrollReset(view);
    return (
        <>
            <Probe />
            <AppRoutes giftShopEnabled={false} />
        </>
    );
};

const renderAt = (initialEntries: string[], initialIndex: number) =>
    render(
        <MemoryRouter initialEntries={initialEntries} initialIndex={initialIndex}>
            <Harness />
        </MemoryRouter>,
    );

/** The legal pages are React.lazy, so every render has to wait for the chunk before clicking. */
const openPage = async (bottomButton: string) => screen.findByRole('button', { name: bottomButton });

const click = async (element: HTMLElement) => {
    await act(async () => {
        fireEvent.click(element);
    });
};

beforeEach(() => {
    window.sessionStorage.clear();
    setScrollY(0);
    scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    frames = [];
    // Deliberately deferred rather than synchronous: the restore has to still be in flight when the
    // view-change effect runs, which is exactly the collision the last test is about.
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => frames.push(callback));
    vi.stubGlobal('cancelAnimationFrame', () => {});
});

afterEach(async () => {
    await act(async () => {
        useQuizStore.setState(originalQuizState, true);
    });
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe.each(PAGES)('$name back control', ({ path, bottomButton }) => {
    it('pops history when the reader opened the page from the home page footer', async () => {
        renderAt(['/', path], 1);
        await openPage(bottomButton);

        await click(screen.getByRole('button', { name: bottomButton }));

        expect(screen.getByTestId('probe')).toHaveTextContent('/|POP');
        expect(await screen.findByText('home-page')).toBeVisible();
        expect(useQuizStore.getState().view).toBe('home');
    });

    it('replaces instead of walking off the site when the page is opened as a direct link', async () => {
        renderAt([path], 0);
        await openPage(bottomButton);

        await click(screen.getByRole('button', { name: bottomButton }));

        expect(screen.getByTestId('probe')).toHaveTextContent('/|REPLACE');
        expect(await screen.findByText('home-page')).toBeVisible();
    });

    it('wires the header arrow to the same handler as the button at the bottom', async () => {
        renderAt(['/', path], 1);
        await openPage(bottomButton);

        // The header control is an icon with no accessible name, so it is taken by DOM order —
        // the page renders it first and the mocked footer contributes no buttons.
        await click(screen.getAllByRole('button')[0]);

        expect(screen.getByTestId('probe')).toHaveTextContent('/|POP');
    });
});

describe('legal page back scroll restore', () => {
    /**
     * goHome() flips the store view to 'home', which is the other branch of useScrollReset — the one
     * that scrolls to the top. This walks the real flow to prove the Back restore still wins.
     */
    it('lets the Back restore win over the view change that goHome triggers', async () => {
        renderAt(['/'], 0);
        await screen.findByText('home-page');

        setScrollY(1371);
        act(() => { window.dispatchEvent(new Event('scroll')); });
        act(() => { navigate('/privacy'); });
        await openPage('Quay lại Trang chủ');
        // A reader whose view is already 'home' makes goHome() a no-op and never reaches the branch
        // under test, so this puts the store where a logged-in teacher opening the policy leaves it.
        act(() => { useQuizStore.setState({ view: 'teacher_dash' }); });
        setScrollY(0);
        scrollTo.mockClear();

        await click(screen.getByRole('button', { name: 'Quay lại Trang chủ' }));

        // The store update flushes in its own commit ahead of navigate(-1), so the view branch
        // scrolls /privacy to the top before the POP even happens.
        expect(scrollTo).toHaveBeenLastCalledWith(0, 0);

        act(() => { frames.shift()?.(0); });

        // The POP restore started after that and gets the last word. A view change landing inside
        // the POP commit would instead cancel the restore, leaving this frame with nothing to do.
        expect(scrollTo).toHaveBeenLastCalledWith(0, 1371);
        expect(useQuizStore.getState().view).toBe('home');
    });
});
