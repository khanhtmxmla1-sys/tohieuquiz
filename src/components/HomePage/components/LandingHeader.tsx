import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { useNavigate } from 'react-router';

const LandingHeader: React.FC = () => {
    const navigate = useNavigate();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const goTo = (path: string) => {
        setIsMenuOpen(false);
        navigate(path);
    };

    const navButtonClass = 'min-h-11 rounded-lg px-2 text-sm font-semibold text-[#334155] transition-colors hover:text-[#2563eb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2';

    return (
        <header className="relative z-30 mx-auto flex w-full max-w-[1280px] items-center justify-between px-4 py-4 md:px-8 lg:px-10 lg:py-5">
            <button
                type="button"
                className="flex min-h-11 items-center gap-2.5 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2"
                onClick={() => goTo('/')}
                aria-label="Về trang chủ TôHiệuQuiz"
            >
                <span className="flex h-11 w-11 items-center justify-center rounded-[14px] border border-[#dbe4f0] bg-white shadow-[0_8px_24px_-18px_rgba(30,58,138,0.8)]">
                    <img src="/favicon.svg" alt="" className="h-8 w-8 object-contain" />
                </span>
                <span className="text-[1.3rem] font-bold tracking-[-0.03em] sm:text-[1.4rem]">
                    <span className="text-[#1e3a8a]">TôHiệu</span>
                    <span className="text-[#eab308]">Quiz</span>
                </span>
            </button>

            <nav className="hidden items-center gap-4 md:flex" aria-label="Điều hướng chính">
                <button type="button" className={navButtonClass} onClick={() => goTo('/')}>Trang chủ</button>
                <button type="button" className={navButtonClass} onClick={() => goTo('/about')}>Giới thiệu</button>
                <button type="button" className={navButtonClass} onClick={() => goTo('/contact')}>Liên hệ</button>
                <a
                    href="https://phuhuynh.thtohieu.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${navButtonClass} inline-flex items-center`}
                >
                    Cổng phụ huynh
                </a>
            </nav>

            <button
                type="button"
                className="flex h-11 w-11 items-center justify-center rounded-[13px] border border-[#dbe4f0] bg-white text-[#1e3a8a] shadow-[0_10px_26px_-20px_rgba(30,58,138,0.8)] transition-colors hover:bg-[#eff6ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 md:hidden"
                aria-label={isMenuOpen ? 'Đóng trình đơn' : 'Mở trình đơn'}
                aria-expanded={isMenuOpen}
                aria-controls="landing-mobile-menu"
                onClick={() => setIsMenuOpen((open) => !open)}
            >
                {isMenuOpen ? <X size={21} aria-hidden="true" /> : <Menu size={21} aria-hidden="true" />}
            </button>

            {isMenuOpen && (
                <nav
                    id="landing-mobile-menu"
                    className="login-page-reveal absolute left-4 right-4 top-[72px] grid gap-1 rounded-[18px] border border-[#dbe4f0] bg-white p-2 shadow-[0_22px_50px_-30px_rgba(15,23,42,0.45)] md:hidden"
                    aria-label="Điều hướng trên điện thoại"
                >
                    <button type="button" className="min-h-11 rounded-xl px-4 text-left font-semibold text-[#334155] hover:bg-[#eff6ff]" onClick={() => goTo('/')}>Trang chủ</button>
                    <button type="button" className="min-h-11 rounded-xl px-4 text-left font-semibold text-[#334155] hover:bg-[#eff6ff]" onClick={() => goTo('/about')}>Giới thiệu</button>
                    <button type="button" className="min-h-11 rounded-xl px-4 text-left font-semibold text-[#334155] hover:bg-[#eff6ff]" onClick={() => goTo('/contact')}>Liên hệ</button>
                    <a
                        href="https://phuhuynh.thtohieu.com/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex min-h-11 items-center rounded-xl px-4 font-semibold text-[#334155] hover:bg-[#eff6ff]"
                    >
                        Cổng phụ huynh
                    </a>
                </nav>
            )}
        </header>
    );
};

export default LandingHeader;
