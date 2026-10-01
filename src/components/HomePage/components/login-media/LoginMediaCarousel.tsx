import React, { useEffect, useState } from 'react';
import LoginMediaImageViewport from './LoginMediaImageViewport';
import type { LoginMediaPublicSettings, LoginMediaPublicSlide } from './loginMedia.types';

interface Props {
  slides: LoginMediaPublicSlide[];
  settings: LoginMediaPublicSettings;
  selectedSlideId?: string | null;
  allowLinks?: boolean;
  onImageError?: () => void;
}

const wrapIndex = (index: number, length: number) => ((index % length) + length) % length;

const LoginMediaCarousel: React.FC<Props> = ({
  slides,
  settings,
  selectedSlideId = null,
  allowLinks = true,
  onImageError,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hoverPaused, setHoverPaused] = useState(false);
  const [focusPaused, setFocusPaused] = useState(false);
  const [userPaused, setUserPaused] = useState(false);

  useEffect(() => {
    setCurrentIndex((index) => (slides.length > 0 ? wrapIndex(index, slides.length) : 0));
  }, [slides.length]);

  useEffect(() => {
    if (!selectedSlideId) return;
    const selectedIndex = slides.findIndex((slide) => slide.id === selectedSlideId);
    if (selectedIndex >= 0) setCurrentIndex(selectedIndex);
  }, [selectedSlideId, slides]);

  const paused = hoverPaused || focusPaused || userPaused;

  useEffect(() => {
    if (slides.length < 2 || !settings.autoplay || paused) return undefined;

    const timer = window.setInterval(() => {
      setCurrentIndex((index) => wrapIndex(index + 1, slides.length));
    }, settings.intervalMs);

    return () => window.clearInterval(timer);
  }, [paused, settings.autoplay, settings.intervalMs, slides.length]);

  if (slides.length === 0) return null;

  const currentSlide = slides[currentIndex] ?? slides[0];
  const canNavigate = slides.length > 1;
  const transitionClass = settings.transition === 'SLIDE' ? 'animate-slide-up' : 'animate-fade-in';

  const goTo = (index: number) => setCurrentIndex(wrapIndex(index, slides.length));
  const goPrevious = () => goTo(currentIndex - 1);
  const goNext = () => goTo(currentIndex + 1);

  const image = (
    <LoginMediaImageViewport
      key={currentSlide.id}
      imageUrl={currentSlide.imageUrl}
      imageWidth={currentSlide.imageWidth}
      imageHeight={currentSlide.imageHeight}
      alt={currentSlide.alt || 'Banner đăng nhập'}
      cropX={currentSlide.cropX}
      cropY={currentSlide.cropY}
      cropZoom={currentSlide.cropZoom}
      imageClassName={transitionClass}
      loading="lazy"
      decoding="async"
      onError={onImageError}
    />
  );

  return (
    <div
      className="relative aspect-[630/286] overflow-hidden bg-[#f8fafc]"
      onMouseEnter={() => {
        if (settings.pauseOnHover) setHoverPaused(true);
      }}
      onMouseLeave={() => {
        if (settings.pauseOnHover) setHoverPaused(false);
      }}
      onFocusCapture={() => setFocusPaused(true)}
      onBlurCapture={(event) => {
        const nextTarget = event.relatedTarget as Node | null;
        if (!nextTarget || !event.currentTarget.contains(nextTarget)) setFocusPaused(false);
      }}
    >
      {allowLinks && currentSlide.linkUrl ? (
        <a
          href={currentSlide.linkUrl}
          target={currentSlide.openNewTab ? '_blank' : undefined}
          rel={currentSlide.openNewTab ? 'noopener noreferrer' : undefined}
          className="block h-full w-full"
        >
          {image}
        </a>
      ) : image}

      {settings.autoplay && canNavigate ? (
        <button
          type="button"
          aria-label={userPaused ? 'Tiếp tục trình chiếu' : 'Tạm dừng trình chiếu'}
          aria-pressed={userPaused}
          onClick={() => setUserPaused((value) => !value)}
          className="absolute right-3 top-3 flex h-10 min-w-10 items-center justify-center rounded-full border border-white/70 bg-slate-900/55 px-3 text-sm font-bold text-white shadow-lg backdrop-blur-sm transition hover:bg-slate-900/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <span aria-hidden="true">{userPaused ? '▶' : 'Ⅱ'}</span>
        </button>
      ) : null}

      {settings.showArrows && canNavigate ? (
        <>
          <button
            type="button"
            aria-label="Ảnh trước"
            onClick={goPrevious}
            className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-slate-900/45 text-2xl font-medium text-white shadow-lg backdrop-blur-sm transition hover:bg-slate-900/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <span aria-hidden="true">‹</span>
          </button>
          <button
            type="button"
            aria-label="Ảnh tiếp theo"
            onClick={goNext}
            className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-slate-900/45 text-2xl font-medium text-white shadow-lg backdrop-blur-sm transition hover:bg-slate-900/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <span aria-hidden="true">›</span>
          </button>
        </>
      ) : null}

      {settings.showDots && canNavigate ? (
        <div className="absolute inset-x-0 bottom-3 flex justify-center gap-2" aria-label="Chọn banner">
          {slides.map((slide, index) => (
            <button
              key={slide.id}
              type="button"
              aria-label={`Ảnh ${index + 1}`}
              aria-current={index === currentIndex ? 'true' : undefined}
              onClick={() => goTo(index)}
              className={`h-2.5 rounded-full border border-white/80 shadow-sm transition-all ${index === currentIndex ? 'w-7 bg-white' : 'w-2.5 bg-white/55 hover:bg-white/80'}`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
};

export default LoginMediaCarousel;
