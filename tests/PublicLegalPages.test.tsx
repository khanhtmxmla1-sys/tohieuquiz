import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import PrivacyPolicy from '../src/components/legal/PrivacyPolicy';
import TermsOfService from '../src/components/legal/TermsOfService';

const renderPage = (page: React.ReactNode, path: string) =>
    render(<MemoryRouter initialEntries={[path]}>{page}</MemoryRouter>);

describe('public legal pages', () => {
    it('renders the school-focused privacy policy and child data safeguards', () => {
        const { container } = renderPage(<PrivacyPolicy onBack={vi.fn()} />, '/privacy');

        expect(screen.getByRole('heading', { name: 'Chính sách bảo mật' })).toBeVisible();
        expect(screen.getByText('Không bán dữ liệu')).toBeVisible();
        expect(screen.getByRole('heading', { name: 'Bảo vệ dữ liệu trẻ em' })).toBeVisible();
        expect(screen.getByText(/không yêu cầu người dùng gửi mật khẩu/i)).toBeVisible();
        expect(screen.getAllByRole('link', { name: 'tongminhkhanh@gmail.com' })[0]).toHaveAttribute('href', 'mailto:tongminhkhanh@gmail.com');
        expect(container.textContent).not.toMatch(/iTongQuiz|ÍtOngQuiz|ItOngQuiz/i);
    });

    it('renders responsible-use rules for academic integrity, AI and cybersecurity', () => {
        const { container } = renderPage(<TermsOfService onBack={vi.fn()} />, '/tos');

        expect(screen.getByRole('heading', { name: 'Điều khoản sử dụng' })).toBeVisible();
        expect(screen.getByRole('heading', { name: 'Thi cử và tính trung thực học tập' })).toBeVisible();
        expect(screen.getByRole('heading', { name: 'Sử dụng công cụ trí tuệ nhân tạo' })).toBeVisible();
        expect(screen.getByRole('heading', { name: 'An toàn thông tin là trách nhiệm chung' })).toBeVisible();
        expect(screen.getByText(/không nhập dữ liệu cá nhân nhạy cảm của học sinh/i)).toBeVisible();
        expect(container.textContent).not.toMatch(/iTongQuiz|ÍtOngQuiz|ItOngQuiz/i);
    });
});
