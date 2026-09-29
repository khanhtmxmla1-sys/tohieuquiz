import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import AboutPage from '../src/components/schoolPage/AboutPage';
import ContactPage from '../src/components/schoolPage/ContactPage';
import Footer from '../src/components/common/Footer';
import SchoolProfilePage from '../src/components/schoolPage/SchoolProfilePage';

const renderPage = (page: React.ReactNode, path: string) =>
    render(<MemoryRouter initialEntries={[path]}>{page}</MemoryRouter>);

describe('public school pages branding and content', () => {
    it('renders the redesigned introduction page with the TôHiệuQuiz brand', () => {
        const { container } = renderPage(<AboutPage />, '/about');

        expect(screen.getByRole('heading', { name: /học vui hơn/i })).toBeVisible();
        expect(screen.getByRole('button', { name: 'Giới thiệu' })).toHaveAttribute('aria-current', 'page');
        expect(screen.getByText('TôHiệuQuiz mang lại điều gì?')).toBeVisible();
        expect(container.textContent).toContain('TôHiệuQuiz');
        expect(container.textContent).not.toMatch(/iTongQuiz|ÍtOngQuiz|ItOngQuiz/i);
    });

    it('renders the school profile with canonical local brand facts', () => {
        const { container } = renderPage(
            <SchoolProfilePage />,
            '/truong-tieu-hoc-to-hieu-son-la',
        );

        expect(
            screen.getByRole('heading', {
                level: 1,
                name: 'Trường Tiểu học Tô Hiệu – Sơn La',
            }),
        ).toBeVisible();
        expect(container.textContent).toContain('Phường Tô Hiệu, tỉnh Sơn La');
        expect(container.textContent).toContain('H52.101.114');
        expect(container.textContent).toContain('TôHiệuQuiz');
        expect(screen.getByRole('button', { name: 'Nhà trường' }))
            .toHaveAttribute('aria-current', 'page');
    });

    it('renders verified support channels and acknowledges the contact form locally', () => {
        const { container } = renderPage(<ContactPage />, '/contact');

        expect(screen.getByRole('heading', { name: /Kết nối với TôHiệuQuiz/i })).toBeVisible();
        expect(screen.getByRole('button', { name: 'Liên hệ' })).toHaveAttribute('aria-current', 'page');
        expect(screen.getByText('0326439774')).toBeVisible();
        expect(screen.getByText('tongminhkhanh@gmail.com')).toBeVisible();
        expect(screen.queryByRole('iframe')).not.toBeInTheDocument();

        const submitButton = screen.getByRole('button', { name: 'Gửi yêu cầu hỗ trợ' });
        const form = submitButton.closest('form');
        expect(form).not.toBeNull();
        fireEvent.submit(form!);

        expect(screen.getByRole('status')).toHaveTextContent('Đã ghi nhận yêu cầu của bạn');
        expect(container.textContent).not.toMatch(/iTongQuiz|ÍtOngQuiz|ItOngQuiz/i);
    });

    it('connects About and Contact to the Sơn La school identity', () => {
        const about = renderPage(<AboutPage />, '/about');
        expect(about.container.textContent).toContain('Trường Tiểu học Tô Hiệu');
        expect(about.container.textContent).toContain('Sơn La');
        about.unmount();

        const contact = renderPage(<ContactPage />, '/contact');
        expect(contact.container.textContent).toContain('Trường Tiểu học Tô Hiệu');
        expect(contact.container.textContent).toContain('Phường Tô Hiệu');
        expect(contact.container.textContent).toContain('Hỗ trợ nền tảng TôHiệuQuiz');
        expect(contact.container.textContent).toContain('thtohieu.tohieu@sonla.gov.vn');
    });

    it('links the public footer to the school profile', () => {
        const onNavigate = vi.fn();
        render(<MemoryRouter><Footer onNavigate={onNavigate} /></MemoryRouter>);

        fireEvent.click(screen.getByRole('button', { name: 'Nhà trường' }));

        expect(onNavigate).toHaveBeenCalledWith('/truong-tieu-hoc-to-hieu-son-la');
        expect(screen.getByText(/Nền tảng học tập trực tuyến của Trường Tiểu học Tô Hiệu/)).toBeVisible();
    });
});
