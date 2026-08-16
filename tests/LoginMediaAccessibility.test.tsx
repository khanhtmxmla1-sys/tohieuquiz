import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LoginMediaSection from '../src/components/HomePage/components/login-media/LoginMediaSection';
import { getLoginMedia } from '../src/services/loginMediaService';

vi.mock('../src/services/loginMediaService', () => ({ getLoginMedia: vi.fn() }));
const mockedGetLoginMedia = vi.mocked(getLoginMedia);
const sliderPayload = {
  mode: 'SLIDER' as const,
  settings: { autoplay: true, intervalMs: 4000, transition: 'FADE' as const, showDots: true, showArrows: true, pauseOnHover: true },
  slides: [
    { id: 'slide-1', imageUrl: 'https://res.cloudinary.com/demo/image/upload/slide-1.jpg', alt: 'Banner một', linkUrl: null, openNewTab: false },
    { id: 'slide-2', imageUrl: 'https://res.cloudinary.com/demo/image/upload/slide-2.jpg', alt: 'Banner hai', linkUrl: null, openNewTab: false },
  ],
};

const installMediaQuery = (matches: boolean) => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({
    matches,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })));
};

describe('LoginMediaSection accessibility and mobile loading', () => {
  beforeEach(() => {
    mockedGetLoginMedia.mockReset();
    installMediaQuery(true);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('does not fetch slider media when the desktop-only surface is hidden', async () => {
    installMediaQuery(false);
    mockedGetLoginMedia.mockResolvedValue({ ...sliderPayload, slides: [] });
    const { container } = render(<LoginMediaSection />);
    await act(async () => Promise.resolve());
    expect(mockedGetLoginMedia).not.toHaveBeenCalled();
    expect(container.querySelector('[data-purpose="learning-preview"]')).toBeInTheDocument();
  });

  it('lazy-loads the visible desktop banner', async () => {
    mockedGetLoginMedia.mockResolvedValue(sliderPayload);
    render(<LoginMediaSection />);
    expect(await screen.findByRole('img', { name: 'Banner một' })).toHaveAttribute('loading', 'lazy');
  });

  it('lets users pause autoplay and pauses while carousel controls have focus', async () => {
    vi.useFakeTimers();
    mockedGetLoginMedia.mockResolvedValue(sliderPayload);
    render(<LoginMediaSection />);
    await act(async () => Promise.resolve());

    const nextButton = screen.getByRole('button', { name: 'Ảnh tiếp theo' });
    fireEvent.focus(nextButton);
    act(() => vi.advanceTimersByTime(4000));
    expect(screen.getByRole('img', { name: 'Banner một' })).toBeInTheDocument();

    fireEvent.blur(nextButton, { relatedTarget: null });
    fireEvent.click(screen.getByRole('button', { name: 'Tạm dừng trình chiếu' }));
    act(() => vi.advanceTimersByTime(8000));
    expect(screen.getByRole('img', { name: 'Banner một' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục trình chiếu' }));
    act(() => vi.advanceTimersByTime(4000));
    expect(screen.getByRole('img', { name: 'Banner hai' })).toBeInTheDocument();
  });
});
