import React from 'react';
import { ArrowLeft, ArrowRight, ChevronDown, Mail, type LucideIcon } from 'lucide-react';
import { useNavigate } from 'react-router';
import PublicPageHeader from '../schoolPage/PublicPageHeader';

export interface LegalNavItem {
    id: string;
    label: string;
}

export interface LegalHighlight {
    icon: LucideIcon;
    title: string;
    description: string;
    accent: string;
}

interface LegalPageScaffoldProps {
    activePage: 'privacy' | 'tos';
    eyebrow: string;
    title: string;
    description: string;
    effectiveDate: string;
    heroIcon: LucideIcon;
    highlights: LegalHighlight[];
    navigation: LegalNavItem[];
    onBack: () => void;
    ctaTitle: string;
    ctaDescription: string;
    backButtonLabel: string;
    children: React.ReactNode;
}

interface LegalSectionProps {
    id: string;
    number: string;
    title: string;
    icon: LucideIcon;
    children: React.ReactNode;
    tone?: 'default' | 'blue' | 'green' | 'amber';
}

const sectionTone = {
    default: 'border-slate-200 bg-white',
    blue: 'border-blue-200 bg-blue-50/65',
    green: 'border-emerald-200 bg-emerald-50/65',
    amber: 'border-amber-200 bg-amber-50/70',
};

export const LegalSection: React.FC<LegalSectionProps> = ({
    id,
    number,
    title,
    icon: Icon,
    children,
    tone = 'default',
}) => (
    <section
        id={id}
        className={`scroll-mt-32 rounded-[24px] border p-5 shadow-[0_10px_32px_rgba(15,23,42,0.04)] sm:p-7 ${sectionTone[tone]}`}
        aria-labelledby={`${id}-heading`}
    >
        <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-100">
                <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
                <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-blue-600">Mục {number}</p>
                <h2 id={`${id}-heading`} className="mt-1 text-xl font-extrabold tracking-tight text-[#172554] sm:text-2xl">
                    {title}
                </h2>
            </div>
        </div>
        <div className="mt-6 space-y-4 text-[15px] leading-7 text-slate-600 sm:text-base sm:leading-8">
            {children}
        </div>
    </section>
);

export const LegalBulletList: React.FC<{ items: React.ReactNode[] }> = ({ items }) => (
    <ul className="space-y-3">
        {items.map((item, index) => (
            <li key={index} className="flex items-start gap-3 text-slate-700">
                <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" />
                <span>{item}</span>
            </li>
        ))}
    </ul>
);

const LegalPageScaffold: React.FC<LegalPageScaffoldProps> = ({
    activePage,
    eyebrow,
    title,
    description,
    effectiveDate,
    heroIcon: HeroIcon,
    highlights,
    navigation,
    onBack,
    ctaTitle,
    ctaDescription,
    backButtonLabel,
    children,
}) => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-[#F7F9FF] font-['Be_Vietnam_Pro'] text-slate-800">
            <PublicPageHeader activePage={activePage} onBack={onBack} />

            <div className="mx-auto max-w-7xl px-4 py-8 sm:py-10 md:px-8 md:py-14">
                <section className="relative overflow-hidden rounded-[32px] border border-blue-100 bg-white px-6 py-9 shadow-[0_20px_60px_rgba(30,64,175,0.08)] sm:px-9 sm:py-12 lg:grid lg:grid-cols-[1fr_0.72fr] lg:items-center lg:gap-12 lg:px-12">
                    <div className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-blue-100/70 blur-3xl" />
                    <div className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-yellow-100/60 blur-3xl" />

                    <div className="relative z-10">
                        <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-extrabold uppercase tracking-[0.12em] text-blue-700 sm:text-sm">
                            <HeroIcon className="h-4 w-4" />
                            {eyebrow}
                        </div>
                        <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-[-0.03em] text-[#172554] sm:text-5xl lg:text-6xl">
                            {title}
                        </h1>
                        <p className="mt-5 max-w-3xl text-base leading-8 text-slate-600 sm:text-lg">{description}</p>
                        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
                            <span className="inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-50 px-4 text-sm font-extrabold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                                Áp dụng từ {effectiveDate}
                            </span>
                            <button
                                type="button"
                                onClick={onBack}
                                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                Quay lại trang trước
                            </button>
                        </div>
                    </div>

                    <div className="relative z-10 mt-9 lg:mt-0" aria-hidden="true">
                        <div className="mx-auto flex aspect-square max-w-[310px] items-center justify-center rounded-[36px] border border-blue-100 bg-[#F8FAFF] p-8 shadow-xl shadow-blue-100/60">
                            <div className="relative flex h-44 w-44 items-center justify-center rounded-full bg-blue-600 text-white shadow-2xl shadow-blue-200">
                                <div className="absolute -right-3 -top-3 h-14 w-14 rounded-2xl bg-yellow-300" />
                                <div className="absolute -bottom-4 -left-4 h-16 w-16 rounded-2xl bg-emerald-400" />
                                <HeroIcon className="relative h-20 w-20" strokeWidth={1.8} />
                            </div>
                        </div>
                    </div>
                </section>

                <section className="mt-6 grid gap-4 md:grid-cols-3" aria-label="Cam kết chính">
                    {highlights.map((item) => (
                        <article key={item.title} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)] sm:p-6">
                            <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${item.accent}`}>
                                <item.icon className="h-5 w-5" />
                            </div>
                            <h2 className="mt-4 text-lg font-extrabold text-slate-900">{item.title}</h2>
                            <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
                        </article>
                    ))}
                </section>

                <div className="sticky top-[72px] z-30 -mx-4 mt-6 border-y border-blue-100 bg-[#F7F9FF]/95 px-4 py-3 backdrop-blur-xl lg:hidden">
                    <details className="group mx-auto max-w-7xl rounded-2xl border border-blue-200 bg-white shadow-sm">
                        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 px-4 font-extrabold text-[#172554] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200">
                            Mục lục {activePage === 'privacy' ? 'chính sách' : 'điều khoản'}
                            <ChevronDown className="h-5 w-5 text-blue-600 transition group-open:rotate-180" />
                        </summary>
                        <nav className="grid gap-1 border-t border-slate-100 p-3" aria-label="Mục lục trên thiết bị di động">
                            {navigation.map((item, index) => (
                                <a
                                    key={item.id}
                                    href={`#${item.id}`}
                                    className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-slate-700 transition hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
                                >
                                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-xs font-extrabold text-blue-700">
                                        {index + 1}
                                    </span>
                                    {item.label}
                                </a>
                            ))}
                        </nav>
                    </details>
                </div>

                <div className="mt-8 grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)] lg:items-start">
                    <aside className="sticky top-28 hidden rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_12px_36px_rgba(15,23,42,0.05)] lg:block">
                        <p className="px-3 pb-3 text-xs font-extrabold uppercase tracking-[0.14em] text-blue-600">Mục lục</p>
                        <nav className="space-y-1" aria-label="Mục lục trang pháp lý">
                            {navigation.map((item, index) => (
                                <a
                                    key={item.id}
                                    href={`#${item.id}`}
                                    className="group flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-slate-600 transition hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
                                >
                                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-extrabold text-slate-600 transition group-hover:bg-blue-600 group-hover:text-white">
                                        {index + 1}
                                    </span>
                                    {item.label}
                                </a>
                            ))}
                        </nav>
                    </aside>

                    <article className="min-w-0 space-y-6">{children}</article>
                </div>

                <div className="mt-8 flex justify-center">
                    <button
                        type="button"
                        onClick={onBack}
                        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 font-extrabold text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
                    >
                        <ArrowLeft className="h-5 w-5" />
                        {backButtonLabel}
                    </button>
                </div>

                <section className="relative mt-10 overflow-hidden rounded-[32px] bg-[#172554] px-6 py-9 text-white shadow-xl sm:px-9 sm:py-11 lg:flex lg:items-center lg:justify-between lg:gap-10">
                    <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />
                    <div className="relative z-10 max-w-3xl">
                        <p className="text-sm font-extrabold uppercase tracking-[0.14em] text-yellow-300">Hỗ trợ & an toàn</p>
                        <h2 className="mt-3 text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">{ctaTitle}</h2>
                        <p className="mt-3 leading-7 text-blue-100">{ctaDescription}</p>
                    </div>
                    <div className="relative z-10 mt-7 flex flex-col gap-3 sm:flex-row lg:mt-0 lg:shrink-0">
                        <button
                            type="button"
                            onClick={() => navigate('/contact')}
                            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-yellow-400 px-6 font-extrabold text-[#172554] transition hover:bg-yellow-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-yellow-200/50"
                        >
                            Liên hệ hỗ trợ
                            <ArrowRight className="h-5 w-5" />
                        </button>
                        <a
                            href="mailto:tongminhkhanh@gmail.com"
                            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/30 px-5 font-bold text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/30"
                        >
                            <Mail className="h-5 w-5" />
                            tongminhkhanh@gmail.com
                        </a>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default LegalPageScaffold;
