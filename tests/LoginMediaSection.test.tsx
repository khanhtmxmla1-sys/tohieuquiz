import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LoginMediaSection from '../src/components/HomePage/components/login-media/LoginMediaSection';
import { getLoginMedia } from '../src/services/loginMediaService';

vi.mock('../src/services/loginMediaService', () => ({
  getLoginMedia: vi.fn(),
}));

const mockedGetLoginMedia = vi.mocked(getLoginMedia);

const sliderPayload = {
  mode: 'SLIDER' as const,
  settings: {
    autoplay: true,
    intervalMs: 4000,
    transition: 'FADE' as const,
    showDots: true,
    showArrows: true,
    pauseOnHover: true,
  },
  slides: [
    { id: 'slide-1', imageUrl: 'https://res.cloudinary.com/demo/image/upload/slide-1.jpg', alt: 'Banner một', linkUrl: null, openNewTab: false },
    { id: 'slide-2', imageUrl: 'https://res.cloudinary.com/demo/image/upload/slide-2.jpg', alt: 'Banner hai', linkUrl: null, openNewTab: false },
  ],
};

describe('LoginMediaSection', () => {
  beforeEach(() => {
    mockedGetLoginMedia.mockReset();
  });
  afterEach(() => vi.useRealTimers());

  it('preserves the learning overview as the safe shell while loading', () => {
    mockedGetLoginMedia.mockReturnValue(new Promise(() => {}));
    const { container } = render(<LoginMediaSection />);

    expect(container.querySelector('[data-purpose="login-media-section"]')).toBeInTheDocument();
    expect(container.querySelector('[data-purpose="learning-preview"]')).toBeInTheDocument();
    expect(screen.getByText('Tổng quan học tập')).toBeInTheDocument();
  });

  it('renders active public slides when the API selects slider mode', async () => {
    mockedGetLoginMedia.mockResolvedValue(sliderPayload);
    const { container } = render(<LoginMediaSection />);

    expect(await screen.findByRole('img', { name: 'Banner một' })).toHaveAttribute('src', sliderPayload.slides[0].imageUrl);
    expect(container.querySelector('[data-purpose="learning-preview"]')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ảnh 1' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: 'Ảnh tiếp theo' })).toBeInTheDocument();
  });

  it('falls back to learning overview when the API fails or returns no usable slides', async () => {
    mockedGetLoginMedia.mockRejectedValueOnce(new Error('offline'));
    const { container, rerender } = render(<LoginMediaSection />);
    await waitFor(() => expect(mockedGetLoginMedia).toHaveBeenCalledTimes(1));
    expect(container.querySelector('[data-purpose="learning-preview"]')).toBeInTheDocument();

    mockedGetLoginMedia.mockResolvedValueOnce({ ...sliderPayload, slides: [] });
    rerender(<LoginMediaSection key="empty" />);
    await waitFor(() => expect(mockedGetLoginMedia).toHaveBeenCalledTimes(2));
    expect(container.querySelector('[data-purpose="learning-preview"]')).toBeInTheDocument();
  });

  it('advances slides automatically and supports manual navigation', async () => {
    vi.useFakeTimers();
    mockedGetLoginMedia.mockResolvedValue(sliderPayload);
    render(<LoginMediaSection />);

    await act(async () => Promise.resolve());
    expect(screen.getByRole('img', { name: 'Banner một' })).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(4000));
    expect(screen.getByRole('img', { name: 'Banner hai' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Ảnh trước' }));
    expect(screen.getByRole('img', { name: 'Banner một' })).toBeInTheDocument();
  });
});