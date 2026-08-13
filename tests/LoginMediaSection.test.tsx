import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import LoginMediaSection from '../src/components/HomePage/components/login-media/LoginMediaSection';

describe('LoginMediaSection', () => {
  it('preserves the learning overview as the safe default shell', () => {
    const { container } = render(<LoginMediaSection />);

    expect(container.querySelector('[data-purpose="login-media-section"]')).toBeInTheDocument();
    expect(container.querySelector('[data-purpose="learning-preview"]')).toBeInTheDocument();
    expect(screen.getByText('Tổng quan học tập')).toBeInTheDocument();
    expect(screen.getByText('Bài kiểm tra Toán')).toBeInTheDocument();
    expect(screen.getByText('Kết quả đã tổng hợp')).toBeInTheDocument();
  });
});
