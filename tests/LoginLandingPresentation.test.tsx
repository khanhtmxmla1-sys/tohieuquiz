import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import HeroSection from '../src/components/HomePage/components/HeroSection';
import LoginForm from '../src/components/HomePage/components/LoginForm';

const renderLoginForm = () => render(
  <LoginForm
    activeTab="teacher"
    setActiveTab={vi.fn()}
    username=""
    setUsername={vi.fn()}
    password=""
    setPassword={vi.fn()}
    isLoading={false}
    onSubmit={vi.fn()}
    onPasskey={vi.fn()}
    passkeyAvailable
  />,
);

describe('Login landing presentation', () => {
  it('uses the calm-learning copy for the hero and login panel', () => {
    render(<HeroSection />);
    expect(screen.getByRole('heading', { level: 1, name: /Học tập thông minh,\s*quản lý thật nhẹ nhàng/i })).toBeInTheDocument();

    renderLoginForm();
    expect(screen.getByRole('heading', { level: 2, name: 'Chào mừng bạn trở lại' })).toBeInTheDocument();
    expect(screen.getByText('Chọn vai trò và đăng nhập để tiếp tục sử dụng TôHiệuQuiz.')).toBeInTheDocument();
  });

  it('keeps the primary action visually simple and prioritizes the form on mobile', () => {
    const { container } = renderLoginForm();
    const loginButton = screen.getByRole('button', { name: 'Đăng nhập' });
    expect(loginButton.querySelector('svg')).toBeNull();
    expect(container.querySelector('section')).toHaveClass('order-1');
  });

  it('keeps the supporting hero compact and the role selector flat', () => {
    const heroRender = render(<HeroSection />);
    expect(screen.getByText('Theo năng lực học sinh')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveClass('lg:text-[3.55rem]');
    expect(heroRender.container.querySelector('[data-purpose="learning-preview"]')).toHaveClass('mt-6');
    heroRender.unmount();

    renderLoginForm();
    expect(screen.getByRole('button', { name: 'Giáo viên' })).toHaveClass('shadow-none');
  });
});
