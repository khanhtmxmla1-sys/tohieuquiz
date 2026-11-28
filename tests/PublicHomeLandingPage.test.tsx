import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import PublicHomeLandingPage from '../src/features/public-home/PublicHomeLandingPage';

const renderLanding = () => render(
    <MemoryRouter initialEntries={['/']}>
        <PublicHomeLandingPage />
    </MemoryRouter>,
);

describe('PublicHomeLandingPage', () => {
    it('renders one public landing landmark and the approved headline', () => {
        renderLanding();

        expect(screen.getByTestId('public-home-landing')).toBeInTheDocument();
        expect(screen.getAllByRole('main')).toHaveLength(1);
        expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
            /Học và kiểm tra trực tuyến, vui như một trò chơi cho học sinh tiểu học/i,
        );
    });

    it('exposes role-specific login destinations without looping back to the public root', () => {
        renderLanding();

        expect(screen.getByRole('link', { name: /học sinh/i })).toHaveAttribute('href', '/?login=student');
        expect(screen.getByRole('link', { name: /giáo viên/i })).toHaveAttribute('href', '/?login=teacher');
        expect(screen.getByRole('link', { name: /phụ huynh/i })).toHaveAttribute(
            'href',
            'https://phuhuynh.thtohieu.com/login',
        );
        expect(screen.getByRole('link', { name: /học sinh/i })).not.toHaveAttribute('href', '/');
        expect(screen.getByRole('link', { name: /giáo viên/i })).not.toHaveAttribute('href', '/');
    });

    it('uses the landing section for generic header and final calls to action', () => {
        renderLanding();

        const sectionCtas = screen.getAllByRole('link').filter((link) => link.getAttribute('href') === '#bat-dau');
        expect(sectionCtas.length).toBeGreaterThanOrEqual(1);
        expect(document.getElementById('bat-dau')).toBeInTheDocument();
    });

    it('keeps public legal, school and competition navigation on internal React routes', () => {
        renderLanding();

        for (const path of [
            '/about',
            '/contact',
            '/privacy',
            '/tos',
            '/truong-tieu-hoc-to-hieu-son-la',
            '/cuoc-thi',
        ]) {
            expect(screen.getAllByRole('link').some((link) => link.getAttribute('href') === path), path).toBe(true);
        }
    });

    it('provides accessible role benefit tabs with one selected panel', () => {
        renderLanding();

        const tablist = screen.getByRole('tablist');
        const tabs = within(tablist).getAllByRole('tab');
        expect(tabs.length).toBeGreaterThanOrEqual(3);
        expect(tabs.filter((tab) => tab.getAttribute('aria-selected') === 'true')).toHaveLength(1);
        expect(screen.getAllByRole('tabpanel')).toHaveLength(1);
    });

    it('supports arrow, Home and End keyboard navigation for role tabs', () => {
        renderLanding();

        const tabs = within(screen.getByRole('tablist')).getAllByRole('tab');
        tabs[0].focus();
        fireEvent.keyDown(tabs[0], { key: 'ArrowRight' });
        expect(tabs[1]).toHaveAttribute('tabindex', '0');
        expect(tabs[1]).toHaveAttribute('aria-selected', 'true');

        fireEvent.keyDown(tabs[1], { key: 'End' });
        expect(tabs.at(-1)).toHaveAttribute('tabindex', '0');
        expect(tabs.at(-1)).toHaveAttribute('aria-selected', 'true');

        fireEvent.keyDown(tabs.at(-1)!, { key: 'Home' });
        expect(tabs[0]).toHaveAttribute('tabindex', '0');
        expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    });

    it('supports opening and closing the mobile navigation with Escape', () => {
        renderLanding();

        const menuButton = screen.getAllByRole('button').find(
            (button) => button.hasAttribute('aria-controls') && button.hasAttribute('aria-expanded'),
        );
        expect(menuButton).toBeDefined();
        expect(menuButton).toHaveAttribute('aria-expanded', 'false');

        fireEvent.click(menuButton!);
        expect(menuButton).toHaveAttribute('aria-expanded', 'true');
        fireEvent.keyDown(menuButton!, { key: 'Escape' });
        expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    });

    it('uses the official local school logo and safe image markup', () => {
        renderLanding();

        const logo = screen.getByRole('img', { name: /tô hiệu|trường tiểu học/i });
        expect(logo).toHaveAttribute('src', expect.stringContaining('/assets/branding/'));
        for (const image of screen.getAllByRole('img')) {
            expect(image).toHaveAttribute('alt');
            expect(image.getAttribute('src')).not.toMatch(/^data:/i);
        }
    });

    it('keeps the page to one main and one footer landmark', () => {
        renderLanding();

        expect(screen.getAllByRole('main')).toHaveLength(1);
        expect(screen.getAllByRole('contentinfo')).toHaveLength(1);
    });
});
