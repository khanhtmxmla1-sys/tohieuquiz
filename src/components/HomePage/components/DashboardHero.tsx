import React from 'react';
import { FLUENT_CDN } from '../constants/dashboard.constants';

interface DashboardHeroProps {
    onScrollToSubjects: () => void;
}

export const DashboardHero: React.FC<DashboardHeroProps> = ({ onScrollToSubjects }) => {
    return (
        <header className="sticker-hero">
            <h1 className="sticker-hero__title">
                Vùng Đất <span className="sticker-hero__title--blue">Tri Thức</span>
                <br />
                Của <span className="sticker-hero__title--yellow">Ong Vàng</span>
            </h1>

            {/* Floating 3D Icons */}
            <div className="sticker-hero__icons">
                <div className="sticker-hero__icon" style={{ animationDelay: '0s' } as React.CSSProperties}>
                    <img src={`${FLUENT_CDN}/Abacus/3D/abacus_3d.png`} alt="Toán" className="sticker-img" />
                </div>
                <div className="sticker-hero__icon" style={{ animationDelay: '1.5s' } as React.CSSProperties}>
                    <img src={`${FLUENT_CDN}/Books/3D/books_3d.png`} alt="Văn" className="sticker-img" />
                </div>
                <div className="sticker-hero__icon" style={{ animationDelay: '2s' } as React.CSSProperties}>
                    <img src={`${FLUENT_CDN}/Graduation%20cap/3D/graduation_cap_3d.png`} alt="Tốt Nghiệp" className="sticker-img" />
                </div>
            </div>

            {/* CTA Button */}
            <button
                onClick={onScrollToSubjects}
                className="sticker-hero__btn"
            >
                CHỌN MÔN HỌC 👇
            </button>
        </header>
    );
};
