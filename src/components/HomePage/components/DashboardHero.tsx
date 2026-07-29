import React from 'react';
import { useReducedExperience } from '../../../hooks/useReducedExperience';
import { FLUENT_CDN } from '../constants/dashboard.constants';

interface DashboardHeroProps {
    onScrollToSubjects: () => void;
}

export const DashboardHero: React.FC<DashboardHeroProps> = ({ onScrollToSubjects }) => {
    const { reduceVisuals } = useReducedExperience();

    return (
        <header className="sticker-hero">
            <h1 className="sticker-hero__title">
                Vùng Đất <span className="sticker-hero__title--blue">Tri Thức</span>
                <br />
                Của <span className="sticker-hero__title--yellow">Ong Vàng</span>
            </h1>

            {reduceVisuals ? (
                <div className="mx-auto mb-4 flex max-w-md items-center justify-center gap-3 rounded-2xl bg-white/80 px-4 py-3 text-sm font-bold text-slate-600" role="status">
                    <span aria-hidden="true">📚 ✏️ 🎓</span>
                    <span>Chế độ tiết kiệm dữ liệu đang bật</span>
                </div>
            ) : (
                <div className="sticker-hero__icons" data-rich-media="dashboard-3d-icons">
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
            )}

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
