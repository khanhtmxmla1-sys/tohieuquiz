import React from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { landingContent } from '../publicHomeLanding.content';

const LandingHero: React.FC = () => (
    <section className="public-home__hero" aria-labelledby="public-home-hero-title">
        <div className="public-home__container public-home__hero-grid">
            <div className="public-home__hero-copy">
                <p className="public-home__eyebrow"><span aria-hidden="true" />{landingContent.eyebrow}</p>
                <h1 id="public-home-hero-title">Học và kiểm tra trực tuyến, <span>vui như một trò chơi</span> cho học sinh tiểu học</h1>
                <p className="public-home__slogan">“{landingContent.slogan}”</p>
                <p className="public-home__hero-lead">{landingContent.lead}</p>
                <div className="public-home__hero-actions">
                    <a className="public-home__button public-home__button--primary" href="#bat-dau">Bắt đầu khám phá <ArrowRight aria-hidden="true" /></a>
                    <a className="public-home__button public-home__button--secondary" href="#tinh-nang">Xem tính năng</a>
                </div>
                <ul className="public-home__hero-points" aria-label="Điểm nổi bật">
                    {landingContent.heroPoints.map((point) => <li key={point}><Check aria-hidden="true" />{point}</li>)}
                </ul>
            </div>
            <div className="public-home__hero-media">
                <div className="public-home__hero-image-frame">
                    <picture>
                        <source media="(max-width: 680px)" srcSet="/assets/landing/v1/classroom-hero-640.webp" />
                        <img src="/assets/landing/v1/classroom-hero-1200.webp" srcSet="/assets/landing/v1/classroom-hero-640.webp 640w, /assets/landing/v1/classroom-hero-1200.webp 1200w" sizes="(max-width: 680px) 92vw, (max-width: 1100px) 48vw, 560px" width={1200} height={800} alt="Học sinh tiểu học học tập cùng giáo viên trong lớp học" fetchPriority="high" decoding="async" />
                    </picture>
                </div>
                <span className="public-home__hero-sticker public-home__hero-sticker--top">Học vui<br /><strong>mỗi ngày</strong></span>
                <span className="public-home__hero-sticker public-home__hero-sticker--bottom">Tiến bộ<br /><strong>từng bước</strong></span>
            </div>
        </div>
    </section>
);

export default LandingHero;
