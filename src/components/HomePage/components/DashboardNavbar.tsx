import React from 'react';
import SchoolLogo from '../../common/SchoolLogo';
import { FLUENT_CDN } from '../constants/dashboard.constants';

interface DashboardNavbarProps {
    isLoggedIn: boolean;
    isTeacherLoggedIn: boolean;
    onResetHome: () => void;
    onOpenLogin: () => void;
    onActionCta: () => void;
}

export const DashboardNavbar: React.FC<DashboardNavbarProps> = ({
    isLoggedIn,
    isTeacherLoggedIn,
    onResetHome,
    onOpenLogin,
    onActionCta
}) => {
    return (
        <nav className="sticker-nav">
            <div className="sticker-nav__inner">
                {/* Logo */}
                <div className="sticker-nav__logo" onClick={onResetHome}>
                    <SchoolLogo
                        size={40}
                        decorative
                        className="sticker-nav__logo-img"
                    />
                    <span className="sticker-nav__logo-text">
                        TôHiệu<span className="sticker-nav__logo-accent">Quiz</span>
                    </span>
                </div>

                {/* Nav Links */}
                <div className="sticker-nav__links">
                    <button
                        onClick={onResetHome}
                        className="sticker-nav__link"
                    >
                        Trang chủ
                    </button>
                    <button className="sticker-nav__link">
                        Cửa hàng
                    </button>
                </div>

                {/* Auth Button */}
                {!isLoggedIn ? (
                    <button
                        onClick={onOpenLogin}
                        className="sticker-nav__cta"
                    >
                        Vào Lớp
                    </button>
                ) : (
                    <button
                        onClick={onActionCta}
                        className="sticker-nav__cta"
                    >
                        {isTeacherLoggedIn ? 'Vào Quản Lý' : 'Vào Học'}
                    </button>
                )}
            </div>
        </nav>
    );
};
