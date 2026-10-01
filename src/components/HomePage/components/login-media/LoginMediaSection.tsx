import React, { useEffect, useMemo, useState } from 'react';
import { getLoginMedia } from '../../../../services/loginMediaService';
import LoginMediaCarousel from './LoginMediaCarousel';
import LearningOverview from './LearningOverview';
import type { LoginMediaPublicData } from './loginMedia.types';

const LOGIN_MEDIA_QUERY = '(min-width: 1024px)';

const LoginMediaSection: React.FC = () => {
  const [media, setMedia] = useState<LoginMediaPublicData | null>(null);
  const [isDesktop, setIsDesktop] = useState(() => (
    typeof window === 'undefined' || typeof window.matchMedia !== 'function'
      ? true
      : window.matchMedia(LOGIN_MEDIA_QUERY).matches
  ));

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') {
      setIsDesktop(true);
      return undefined;
    }
    const mediaQuery = window.matchMedia(LOGIN_MEDIA_QUERY);
    const handleChange = (event: MediaQueryListEvent) => setIsDesktop(event.matches);
    setIsDesktop(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    if (!isDesktop) {
      setMedia(null);
      return undefined;
    }

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
  }, [isDesktop]);

  const slides = useMemo(() => (
    media?.mode === 'SLIDER' && !media.degraded ? media.slides : []
  ), [media]);

  if (!media || slides.length === 0) {
    return (
      <div className="contents" data-purpose="login-media-section">
        <LearningOverview />
      </div>
    );
  }

  return (
    <div className="contents" data-purpose="login-media-section">
      <section
        data-purpose="login-media-slider"
        className="login-page-reveal login-page-reveal-delay-2 relative mt-6 hidden max-w-[630px] lg:block"
        aria-roledescription="carousel"
        aria-label="Banner trang đăng nhập"
      >
        <div className="overflow-hidden rounded-[24px] border border-[#dce5f1] bg-white shadow-[0_22px_54px_-44px_rgba(30,58,138,0.42)]">
          <LoginMediaCarousel
            slides={slides}
            settings={media.settings}
            onImageError={() => setMedia(null)}
          />
        </div>
      </section>
    </div>
  );
};

export default LoginMediaSection;
