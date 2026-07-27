import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import AboutPage from '../src/components/schoolPage/AboutPage';
import ContactPage from '../src/components/schoolPage/ContactPage';

const renderPage = (page: React.ReactNode, path: string) =>
    render(<MemoryRouter initialEntries={[path]}>{page}</MemoryRouter>);

describe('public school pages branding and content', () => {
    it('renders the redesigned introduction page with the TôHiệuQuiz brand', () => {
        const { container } = renderPage(<AboutPage />, '/about');

        expect(screen.getByRole('heading', { name: /Học vui hơn/i })).toBeVisible();
        expect(screen.getByRole('button', { name: 'Giới thiệu' })).toHaveAttribute('aria-current', 'page');
        expect(screen.getByText('TôHiệuQuiz mang lại điều gì?')).toBeVisible();
        expect(container.textContent).toContain('TôHiệuQuiz');
        expect(container.textContent).not.toMatch(/iTongQuiz|ÍtOngQuiz|ItOngQuiz/i);
    });

    it('renders verified support channels and acknowledges the contact form locally', () => {
        const { container } = renderPage(<ContactPage />, '/contact');

        expect(screen.getByRole('heading', { name: /Kết nối với TôHiệuQuiz/i })).toBeVisible();
        expect(screen.getByRole('button', { name: 'Liên hệ' })).toHaveAttribute('aria-current', 'page');
        expect(screen.getByText('0212 388 8888')).toBeVisible();
        expect(screen.getByText('support@thtohieu.com')).toBeVisible();
        expect(screen.queryByRole('iframe')).not.toBeInTheDocument();

        const submitButton = screen.getByRole('button', { name: 'Gửi yêu cầu hỗ trợ' });
        const form = submitButton.closest('form');
        expect(form).not.toBeNull();
        fireEvent.submit(form!);

        expect(screen.getByRole('status')).toHaveTextContent('Đã ghi nhận yêu cầu của bạn');
        expect(container.textContent).not.toMatch(/iTongQuiz|ÍtOngQuiz|ItOngQuiz/i);
    });
});
