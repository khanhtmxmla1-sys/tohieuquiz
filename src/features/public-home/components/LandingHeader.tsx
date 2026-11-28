import React, { useEffect, useRef, useState } from 'react';
import { Menu, X } from 'lucide-react';
import SchoolLogo from '../../../components/common/SchoolLogo';
import { landingContent } from '../publicHomeLanding.content';

const navItems = [
    { href: '#doi-tuong', label: 'Dành cho ai' },
    { href: '#tinh-nang', label: 'Tính năng' },
    { href: '#trang-nguyen', label: 'Trạng Nguyên Nhí' },
    { href: '#loi-ich', label: 'Lợi ích' },
    { href: '#bat-dau', label: 'Bắt đầu' },
];

const LandingHeader: React.FC = () => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuButtonRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (!isMenuOpen) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsMenuOpen(false);
                menuButtonRef.current?.focus();
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isMenuOpen]);

    const closeMenu = () => setIsMenuOpen(false);

    return (
        <header className="public-home__header">
            <div className="public-home__header-inner">
                <a className="public-home__brand" href="#top" aria-label="TôHiệuQuiz — về đầu trang" onClick={closeMenu}>
                    <span className="public-home__brand-mark">
                        <SchoolLogo size={32} alt="Logo Trường Tiểu học Tô Hiệu" />
                    </span>
                    <span>
                        <span className="public-home__brand-name">TôHiệu<span>Quiz</span></span>
                        <span className="public-home__brand-subline">{landingContent.brandSubline}</span>
                    </span>
                </a>
                <nav className="public-home__desktop-nav" aria-label="Điều hướng chính">
                    {navItems.map((item) => (
                        <a key={item.href} href={item.href}>{item.label}</a>
                    ))}
                </nav>
                <a className="public-home__header-cta" href="#bat-dau">Vào hệ thống</a>
                <button
                    ref={menuButtonRef}
                    type="button"
                    className="public-home__menu-button"
                    aria-label={isMenuOpen ? 'Đóng trình đơn' : 'Mở trình đơn'}
                    aria-expanded={isMenuOpen}
                    aria-controls="public-home-mobile-menu"
                    onClick={() => setIsMenuOpen((open) => !open)}
                >
                    {isMenuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
                </button>
            </div>
            {isMenuOpen ? (
                <nav id="public-home-mobile-menu" className="public-home__mobile-nav" aria-label="Điều hướng trên điện thoại">
                    {navItems.map((item) => (
                        <a key={item.href} href={item.href} onClick={closeMenu}>{item.label}</a>
                    ))}
                    <a className="public-home__mobile-cta" href="#bat-dau" onClick={closeMenu}>Vào hệ thống</a>
                </nav>
            ) : null}
        </header>
    );
};

export default LandingHeader;
