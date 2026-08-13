import React, { useEffect, useMemo, useState } from 'react';
import { getLoginMedia } from '../../../../services/loginMediaService';
import LearningOverview from './LearningOverview';
import type { LoginMediaPublicData, LoginMediaPublicSlide } from './loginMedia.types';

const wrapIndex = (index: number, length: number) => ((index % length) + length) % length;

const LoginMediaSection: React.FC = () => {
  const [media, setMedia] = useState<LoginMediaPublicData | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void getLoginMedia()
      .then((data) => {
        if (!cancelled) setMedia(data);
      })
      .catch(() => {
        if (!cancelled) setMedia(null);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const slides = useMemo(() => (
    media?.mode === 'SLIDER' && !media.degraded ? media.slides : []
  ), [media]);

  useEffect(() => {
    setCurrentIndex((index) => (slides.length > 0 ? wrapIndex(index, slides.length) : 0));
  }, [slides.length]);

  useEffect(() => {
    if (!media || slides.length < 2 || !media.settings.autoplay || paused) return undefined;

    const timer = window.setInterval(() => {
      setCurrentIndex((index) => wrapIndex(index + 1, slides.length));
    }, media.settings.intervalMs);

    return () => window.clearInterval(timer);
  }, [media, paused, slides.length]);

  if (!media || slides.length === 0) {
    return (
      <div className="contents" data-purpose="login-media-section">
        <LearningOverview />
      </div>
    );
  }

  const currentSlide = slides[currentIndex] ?? slides[0];
  const canNavigate = slides.length > 1;
  const transitionClass = media.settings.transition === 'SLIDE' ? 'animate-slide-up' : 'animate-fade-in';

  const goTo = (index: number) => setCurrentIndex(wrapIndex(index, slides.length));
  const goPrevious = () => goTo(currentIndex - 1);
  const goNext = () => goTo(currentIndex + 1);

  const image = (
    <img
      key={currentSlide.id}
      src={currentSlide.imageUrl}
      alt={currentSlide.alt || 'Banner đăng nhập'}
      className={`h-full w-full object-cover ${transitionClass}`}
      loading="eager"
      decoding="async"
      onError={() => setMedia(null)}
    />
  );

  return (
    <div className="contents" data-purpose="login-media-section">
      <section
        data-purpose="login-media-slider"
        className="login-page-reveal login-page-reveal-delay-2 relative mt-6 hidden max-w-[630px] lg:block"
        aria-roledescription="carousel"
        aria-label="Banner trang đăng nhập"
        onMouseEnter={() => {
          if (media.settings.pauseOnHover) setPaused(true);
        }}
        onMouseLeave={() => {
          if (media.settings.pauseOnHover) setPaused(false);
        }}
      >
        <div className="overflow-hidden rounded-[24px] border border-[#dce5f1] bg-white shadow-[0_22px_54px_-44px_rgba(30,58,138,0.42)]">
          <div className="relative aspect-[630/286] overflow-hidden bg-[#f8fafc]">
            {currentSlide.linkUrl ? (
              <a
                href={currentSlide.linkUrl}
                target={currentSlide.openNewTab ? '_blank' : undefined}
                rel={currentSlide.openNewTab ? 'noopener noreferrer' : undefined}
                className="block h-full w-full"
              >
                {image}
              </a>
            ) : image}

            {media.settings.showArrows && canNavigate ? (
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

            {media.settings.showDots && canNavigate ? (
              <div className="absolute inset-x-0 bottom-3 flex justify-center gap-2" aria-label="Chọn banner">
                {slides.map((slide: LoginMediaPublicSlide, index) => (
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
        </div>
      </section>
    </div>
  );
};

export default LoginMediaSection;