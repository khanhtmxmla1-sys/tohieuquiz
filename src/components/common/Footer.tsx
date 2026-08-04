import { getSystemDateParts } from '../../utils/dateTime';
import React from 'react';
import { ArrowUpRight, Globe, Mail, ShieldCheck } from 'lucide-react';
import { SCHOOL_NAME } from '../../config/constants';

export type FooterRoutePath = '/' | '/about' | '/contact' | '/privacy' | '/tos';

interface Props {
    onNavigate: (path: FooterRoutePath) => void;
    showPublicLinks?: boolean;
}

const publicLinks: Array<{ name: string; path: FooterRoutePath }> = [
    { name: 'Trang chủ', path: '/' },
    { name: 'Giới thiệu', path: '/about' },
    { name: 'Liên hệ', path: '/contact' },
];

const legalLinks: Array<{ name: string; path: FooterRoutePath }> = [
    { name: 'Chính sách bảo mật', path: '/privacy' },
    { name: 'Điều khoản sử dụng', path: '/tos' },
];

const Footer: React.FC<Props> = ({ onNavigate, showPublicLinks = true }) => {
    const currentYear = getSystemDateParts().year;

    if (!showPublicLinks) {
        return (
            <footer className="border-t border-slate-200 bg-white px-6 py-7 font-['Be_Vietnam_Pro']">
                <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-5 text-center sm:flex-row sm:text-left">
                    <button
                        type="button"
                        onClick={() => onNavigate('/')}
                        className="inline-flex min-h-11 items-center gap-2 rounded-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
                        aria-label="Về trang chủ TôHiệuQuiz"
                    >
                        <img src="/favicon.svg" alt="" className="h-9 w-9 object-contain" />
                        <span className="text-lg font-extrabold tracking-tight">
                            <span className="text-[#1E3A8A]">TôHiệu</span>
                            <span className="text-[#EAB308]">Quiz</span>
                        </span>
                    </button>
                    <p className="text-sm text-slate-500">© {currentYear} TôHiệuQuiz. Bảo lưu mọi quyền.</p>
                    <div className="flex flex-wrap justify-center gap-2">
                        {legalLinks.map((item) => (
                            <button
                                key={item.path}
                                type="button"
                                onClick={() => onNavigate(item.path)}
                                className="inline-flex min-h-10 items-center rounded-lg px-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
                            >
                                {item.name}
                            </button>
                        ))}
                    </div>
                </div>
            </footer>
        );
    }

    return (
        <footer className="relative overflow-hidden border-t border-blue-100 bg-[#EFF6FF] px-4 pb-8 pt-14 font-['Be_Vietnam_Pro'] md:px-8 md:pt-16">
            <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-blue-200/40 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-28 right-0 h-80 w-80 rounded-full bg-yellow-100/70 blur-3xl" />

            <div className="relative z-10 mx-auto max-w-7xl">
                <div className="grid gap-10 border-b border-blue-200/70 pb-12 sm:grid-cols-2 lg:grid-cols-[1.3fr_0.7fr_0.9fr_1.1fr]">
                    <div>
                        <button
                            type="button"
                            onClick={() => onNavigate('/')}
                            className="inline-flex min-h-11 items-center gap-2.5 rounded-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
                            aria-label="Về trang chủ TôHiệuQuiz"
                        >
                            <img src="/favicon.svg" alt="" className="h-11 w-11 object-contain" />
                            <span className="text-2xl font-extrabold tracking-tight">
                                <span className="text-[#1E3A8A]">TôHiệu</span>
                                <span className="text-[#EAB308]">Quiz</span>
                            </span>
                        </button>
                        <p className="mt-5 max-w-sm text-sm font-medium leading-7 text-slate-600">
                            Nền tảng luyện tập dành cho tiểu học, giúp giáo viên dạy nhẹ nhàng hơn và học sinh tiến bộ tích cực mỗi ngày.
                        </p>
                        <div className="mt-6 flex gap-3">
                            <a
                                href="https://www.thtohieu.com"
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-blue-200 bg-white text-blue-700 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
                                aria-label="Mở website TôHiệuQuiz"
                            >
                                <Globe className="h-5 w-5" />
                            </a>
                            <a
                                href="mailto:support@thtohieu.com"
                                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-blue-200 bg-white text-blue-700 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
                                aria-label="Gửi email cho TôHiệuQuiz"
                            >
                                <Mail className="h-5 w-5" />
                            </a>
                        </div>
                    </div>

                    <div>
                        <h2 className="text-sm font-extrabold uppercase tracking-[0.12em] text-[#172554]">Khám phá</h2>
                        <ul className="mt-5 space-y-2">
                            {publicLinks.map((item) => (
                                <li key={item.path}>
                                    <button
                                        type="button"
                                        onClick={() => onNavigate(item.path)}
                                        className="inline-flex min-h-10 items-center rounded-lg text-sm font-semibold text-slate-600 transition hover:translate-x-1 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
                                    >
                                        {item.name}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div>
                        <h2 className="text-sm font-extrabold uppercase tracking-[0.12em] text-[#172554]">Hỗ trợ & pháp lý</h2>
                        <ul className="mt-5 space-y-2">
                            {legalLinks.map((item) => (
                                <li key={item.path}>
                                    <button
                                        type="button"
                                        onClick={() => onNavigate(item.path)}
                                        className="inline-flex min-h-10 items-center rounded-lg text-left text-sm font-semibold text-slate-600 transition hover:translate-x-1 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
                                    >
                                        {item.name}
                                    </button>
                                </li>
                            ))}
                            <li>
                                <a
                                    href="mailto:support@thtohieu.com"
                                    className="inline-flex min-h-10 items-center gap-1 rounded-lg text-sm font-semibold text-slate-600 transition hover:translate-x-1 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
                                >
                                    Email hỗ trợ
                                    <ArrowUpRight className="h-4 w-4" />
                                </a>
                            </li>
                        </ul>
                    </div>

                    <div>
                        <h2 className="text-sm font-extrabold uppercase tracking-[0.12em] text-[#172554]">Thông tin nền tảng</h2>
                        <div className="mt-5 rounded-2xl border border-blue-200 bg-white/80 p-5 shadow-sm backdrop-blur">
                            <div className="flex items-start gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                                    <ShieldCheck className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-sm font-extrabold text-[#172554]">{SCHOOL_NAME}</p>
                                    <p className="mt-2 text-xs font-medium leading-6 text-slate-600">
                                        Thông tin pháp nhân và địa chỉ hỗ trợ sẽ được cập nhật trước khi mở dịch vụ chính thức.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-3 pt-7 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                    <p>© {currentYear} TôHiệuQuiz. Bảo lưu mọi quyền.</p>
                    <p>Thiết kế cho trải nghiệm học tập an toàn, rõ ràng và tích cực.</p>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
