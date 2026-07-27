import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Menu, X } from 'lucide-react';
import { useNavigate } from 'react-router';

type PublicPage = 'about' | 'contact' | 'privacy' | 'tos';

interface PublicPageHeaderProps {
    activePage: PublicPage;
    onBack?: () => void;
}

const navItems = [
    { label: 'Trang chủ', path: '/', key: 'home' },
    { label: 'Giới thiệu', path: '/about', key: 'about' },
    { label: 'Liên hệ', path: '/contact', key: 'contact' },
] as const;

const PublicPageHeader: React.FC<PublicPageHeaderProps> = ({ activePage, onBack }) => {
    const navigate = useNavigate();
    const [mobileOpen, setMobileOpen] = useState(false);

    const goTo = (path: string) => {
        setMobileOpen(false);
        navigate(path);
    };

    const navButtonClass = (key: string) => {
        const active = key === activePage;
        return [
            'inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold transition-colors',
            'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200',
            active
                ? 'bg-blue-50 text-blue-700'
                : 'text-slate-600 hover:bg-slate-50 hover:text-blue-700',
        ].join(' ');
    };

    return (
        <header className="sticky top-0 z-40 border-b border-blue-100/80 bg-white/90 backdrop-blur-xl">
            <div className="mx-auto flex min-h-[72px] max-w-7xl items-center justify-between gap-4 px-4 md:px-8">
                <div className="flex min-w-0 items-center gap-2">
                    {onBack ? (
                        <button
                            type="button"
                            onClick={onBack}
                            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
                            title="Quay lại"
                        >
                            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
                        </button>
                    ) : null}
                <button
                    type="button"
                    onClick={() => goTo('/')}
                    className="inline-flex min-h-11 items-center gap-2.5 rounded-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
                    aria-label="Về trang chủ TôHiệuQuiz"
                >
                    <img src="/favicon.svg" alt="" className="h-10 w-10 object-contain" />
                    <span className="text-xl font-extrabold tracking-tight sm:text-2xl">
                        <span className="text-[#1E3A8A]">TôHiệu</span>
                        <span className="text-[#EAB308]">Quiz</span>
                    </span>
                </button>
                </div>

                <div className="hidden items-center gap-3 md:flex">
                    <nav className="flex items-center gap-1" aria-label="Điều hướng trang công khai">
                        {navItems.map((item) => (
                            <button
                                key={item.key}
                                type="button"
                                onClick={() => goTo(item.path)}
                                className={navButtonClass(item.key)}
                                aria-current={item.key === activePage ? 'page' : undefined}
                            >
                                {item.label}
                            </button>
                        ))}
                    </nav>
                    <button
                        type="button"
                        onClick={() => goTo('/')}
                        className="inline-flex min-h-11 items-center gap-2 rounded-full bg-blue-600 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
                    >
                        Khám phá nền tảng
                        <ArrowRight className="h-4 w-4" />
                    </button>
                </div>

                <button
                    type="button"
                    className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 md:hidden"
                    aria-expanded={mobileOpen}
                    aria-controls="public-mobile-menu"
                    aria-label={mobileOpen ? 'Đóng menu' : 'Mở menu'}
                    onClick={() => setMobileOpen((open) => !open)}
                >
                    {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </button>
            </div>

            {mobileOpen && (
                <div id="public-mobile-menu" className="border-t border-blue-100 bg-white px-4 py-4 md:hidden">
                    <nav className="mx-auto flex max-w-7xl flex-col gap-2" aria-label="Điều hướng di động">
                        {navItems.map((item) => (
                            <button
                                key={item.key}
                                type="button"
                                onClick={() => goTo(item.path)}
                                className={`${navButtonClass(item.key)} w-full justify-start rounded-xl`}
                                aria-current={item.key === activePage ? 'page' : undefined}
                            >
                                {item.label}
                            </button>
                        ))}
                        <button
                            type="button"
                            onClick={() => goTo('/')}
                            className="mt-1 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
                        >
                            Khám phá nền tảng
                            <ArrowRight className="h-4 w-4" />
                        </button>
                    </nav>
                </div>
            )}
        </header>
    );
};

export default PublicPageHeader;
