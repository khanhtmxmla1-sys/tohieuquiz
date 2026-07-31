import React from 'react';
import {
    BarChart3,
    BookOpenCheck,
    Check,
    ClipboardCheck,
    Clock3,
    FileQuestion,
    TrendingUp,
} from 'lucide-react';

const features = [
    { icon: ClipboardCheck, text: 'Tạo và quản lý bài kiểm tra' },
    { icon: BarChart3, text: 'Theo dõi kết quả học tập' },
    { icon: BookOpenCheck, text: 'Ôn luyện thuận tiện mỗi ngày' },
];

const HeroSection: React.FC = () => {
    return (
        <section className="w-full max-w-[700px] lg:pr-2" aria-labelledby="login-hero-title">
            <div className="login-page-reveal">
                <div className="mb-3 inline-flex min-h-8 items-center gap-2 rounded-[10px] border border-[#bfdbfe] bg-[#eff6ff] px-3 text-[0.68rem] font-bold uppercase tracking-[0.17em] text-[#1d4ed8] sm:mb-4 sm:text-xs">
                    <span className="h-2 w-2 rounded-[3px] bg-[#facc15]" aria-hidden="true" />
                    Nền tảng giáo dục trực tuyến
                </div>

                <h1
                    id="login-hero-title"
                    className="max-w-[680px] text-[clamp(2rem,9vw,4.15rem)] font-bold leading-[1.08] tracking-[-0.045em] text-[#1e3a8a] sm:text-[clamp(2.35rem,7vw,4.15rem)] lg:text-[clamp(2.35rem,5vw,4.15rem)]"
                >
                    Học tập thông minh,
                    <span className="block text-[#2563eb]">quản lý dễ dàng</span>
                </h1>

                <p className="mt-4 hidden max-w-[620px] text-sm leading-6 text-[#475569] min-[360px]:block sm:mt-5 sm:text-[1.05rem] sm:leading-8">
                    TôHiệuQuiz giúp giáo viên tổ chức kiểm tra, theo dõi kết quả và giúp học sinh ôn luyện thuận tiện mỗi ngày.
                </p>
            </div>

            <div className="login-page-reveal login-page-reveal-delay-1 mt-7 hidden grid-cols-1 gap-3 sm:grid-cols-3 md:grid lg:max-w-[650px]">
                {features.map(({ icon: FeatureIcon, text }) => (
                    <div key={text} className="flex min-h-[72px] items-center gap-3 rounded-[16px] border border-[#dbe4f0] bg-white/80 px-3.5 py-3 shadow-[0_12px_32px_-28px_rgba(30,58,138,0.65)]">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[#eff6ff] text-[#2563eb]">
                            <FeatureIcon size={19} strokeWidth={1.8} aria-hidden="true" />
                        </span>
                        <span className="text-sm font-semibold leading-5 text-[#334155]">{text}</span>
                    </div>
                ))}
            </div>

            <div className="login-page-reveal login-page-reveal-delay-2 relative mt-8 hidden max-w-[650px] lg:block" aria-hidden="true">
                <div className="rounded-[26px] border border-[#dbe4f0] bg-white/55 p-1.5 shadow-[0_26px_70px_-44px_rgba(30,58,138,0.55)]">
                    <div className="overflow-hidden rounded-[21px] bg-white">
                        <div className="flex items-center justify-between border-b border-[#e2e8f0] px-5 py-3.5">
                            <div className="flex items-center gap-2">
                                <span className="h-2.5 w-2.5 rounded-full bg-[#facc15]" />
                                <span className="text-xs font-bold uppercase tracking-[0.13em] text-[#64748b]">Tổng quan học tập</span>
                            </div>
                            <div className="flex items-center gap-1.5 rounded-lg bg-[#f8fafc] px-2.5 py-1.5 text-xs font-semibold text-[#64748b]">
                                <Clock3 size={14} /> Tuần này
                            </div>
                        </div>

                        <div className="grid grid-cols-[1.25fr_0.75fr] gap-4 p-5">
                            <div className="rounded-[17px] bg-[#f8fafc] p-4">
                                <div className="mb-5 flex items-start justify-between">
                                    <div>
                                        <p className="text-xs font-semibold text-[#64748b]">Tiến độ lớp học</p>
                                        <p className="mt-1 text-xl font-bold tracking-[-0.03em] text-[#0f172a]">Ổn định và tích cực</p>
                                    </div>
                                    <span className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-[#dbeafe] text-[#2563eb]">
                                        <TrendingUp size={18} />
                                    </span>
                                </div>
                                <div className="flex h-24 items-end gap-3 border-b border-[#dbe4f0] pb-1">
                                    {['h-[38%]', 'h-[55%]', 'h-[47%]', 'h-[72%]', 'h-[62%]', 'h-[84%]'].map((height, index) => (
                                        <span
                                            key={`${height}-${index}`}
                                            className={`flex-1 rounded-t-[7px] ${height} ${index === 5 ? 'bg-[#2563eb]' : 'bg-[#bfdbfe]'}`}
                                        />
                                    ))}
                                </div>
                            </div>

                            <div className="grid gap-3">
                                <div className="rounded-[17px] border border-[#dbe4f0] bg-white p-3.5">
                                    <div className="flex items-center justify-between">
                                        <span className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-[#fef3c7] text-[#a16207]">
                                            <FileQuestion size={18} />
                                        </span>
                                        <span className="rounded-md bg-[#eff6ff] px-2 py-1 text-[0.65rem] font-bold uppercase tracking-wider text-[#2563eb]">Sắp tới</span>
                                    </div>
                                    <p className="mt-3 text-sm font-bold text-[#1e293b]">Bài kiểm tra Toán</p>
                                    <p className="mt-1 text-xs text-[#64748b]">Sẵn sàng cho lớp học</p>
                                </div>

                                <div className="rounded-[17px] bg-[#1e3a8a] p-3.5 text-white">
                                    <div className="flex items-center gap-2 text-sm font-bold">
                                        <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-white/10">
                                            <Check size={17} />
                                        </span>
                                        Báo cáo tự động
                                    </div>
                                    <p className="mt-2 text-xs leading-5 text-blue-100">Kết quả được tổng hợp rõ ràng sau mỗi bài làm.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default HeroSection;
