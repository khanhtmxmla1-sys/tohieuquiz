import React from 'react';
import {
    ArrowRight,
    BarChart3,
    BookOpenCheck,
    CheckCircle2,
    ClipboardCheck,
    GraduationCap,
    HeartHandshake,
    Lightbulb,
    LockKeyhole,
    MessageCircle,
    Rocket,
    ShieldCheck,
    Sparkles,
    Users,
    WandSparkles,
} from 'lucide-react';
import { useNavigate } from 'react-router';
import PublicPageHeader from './PublicPageHeader';

const audiences = [
    {
        icon: ClipboardCheck,
        title: 'Dành cho giáo viên',
        description: 'Giảm thời gian thao tác để tập trung nhiều hơn cho chất lượng bài dạy.',
        items: ['Tạo và quản lý đề thuận tiện', 'Giao bài theo lớp hoặc nhóm', 'Theo dõi kết quả rõ ràng'],
        accent: 'bg-blue-50 text-blue-700',
    },
    {
        icon: GraduationCap,
        title: 'Dành cho học sinh',
        description: 'Biến mỗi lần luyện tập thành một trải nghiệm nhẹ nhàng và có động lực.',
        items: ['Giao diện trực quan, dễ sử dụng', 'Phản hồi tiến bộ kịp thời', 'Khuyến khích thói quen tự học'],
        accent: 'bg-amber-50 text-amber-700',
    },
    {
        icon: HeartHandshake,
        title: 'Dành cho phụ huynh',
        description: 'Đồng hành cùng con bằng những thông tin học tập dễ hiểu và thiết thực.',
        items: ['Nắm được tiến độ luyện tập', 'Hiểu điểm mạnh cần phát huy', 'Kết nối thuận tiện với nhà trường'],
        accent: 'bg-emerald-50 text-emerald-700',
    },
];

const capabilities = [
    { icon: WandSparkles, title: 'Tạo đề nhanh', description: 'Tổ chức ngân hàng câu hỏi và xây dựng bài luyện tập thuận tiện.' },
    { icon: BookOpenCheck, title: 'Giao bài linh hoạt', description: 'Phù hợp với nhiều lớp, nhóm học sinh và kế hoạch học tập.' },
    { icon: BarChart3, title: 'Theo dõi tiến bộ', description: 'Tổng hợp kết quả rõ ràng để giáo viên kịp thời hỗ trợ.' },
    { icon: Sparkles, title: 'Học tập hứng thú', description: 'Trải nghiệm thân thiện giúp học sinh duy trì động lực mỗi ngày.' },
];

const milestones = [
    { year: '2016', title: 'Khởi đầu từ nhu cầu lớp học', description: 'Ghi nhận những thao tác lặp lại trong việc tạo đề, giao bài và tổng hợp kết quả.' },
    { year: '2019', title: 'Mở rộng công cụ hỗ trợ', description: 'Từng bước số hóa nội dung luyện tập và cách giáo viên quản lý hoạt động học tập.' },
    { year: '2023', title: 'Tăng tốc chuyển đổi số', description: 'Kết nối quy trình tạo đề, giao bài và theo dõi tiến bộ trên cùng một nền tảng.' },
    { year: '2026', title: 'Hoàn thiện trải nghiệm TôHiệuQuiz', description: 'Ưu tiên tính dễ dùng, an toàn và khả năng đồng hành giữa giáo viên, học sinh, phụ huynh.' },
];

const values = [
    { icon: ShieldCheck, title: 'An toàn', description: 'Tôn trọng dữ liệu và xây dựng trải nghiệm phù hợp với môi trường giáo dục.' },
    { icon: Lightbulb, title: 'Dễ sử dụng', description: 'Mọi thao tác quan trọng đều rõ ràng, nhất quán và dễ tiếp cận.' },
    { icon: Rocket, title: 'Khích lệ tiến bộ', description: 'Tập trung vào sự tiến bộ từng bước thay vì chỉ nhìn vào điểm số.' },
    { icon: Users, title: 'Kết nối đồng hành', description: 'Giúp nhà trường và gia đình cùng hiểu, cùng hỗ trợ người học.' },
];

const AboutPage: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-[#F7F9FF] font-['Be_Vietnam_Pro'] text-slate-800">
            <PublicPageHeader activePage="about" />

            <div className="mx-auto max-w-7xl space-y-20 px-4 py-10 md:px-8 md:py-16 lg:space-y-24">
                <section className="relative overflow-hidden rounded-[32px] border border-blue-100 bg-white px-6 py-10 shadow-[0_20px_60px_rgba(30,64,175,0.08)] md:px-10 md:py-14 lg:grid lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-12 lg:px-14">
                    <div className="pointer-events-none absolute -right-28 -top-28 h-72 w-72 rounded-full bg-blue-100/60 blur-3xl" />
                    <div className="pointer-events-none absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-yellow-100/70 blur-3xl" />

                    <div className="relative z-10">
                        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-blue-700 sm:text-sm">
                            <Sparkles className="h-4 w-4" />
                            Nền tảng học tập dành cho tiểu học
                        </div>
                        <h1 className="max-w-3xl text-4xl font-extrabold leading-tight tracking-[-0.03em] text-[#172554] sm:text-5xl lg:text-6xl">
                            Học vui hơn. <span className="text-blue-600">Dạy nhẹ nhàng hơn.</span>
                        </h1>
                        <p className="mt-6 max-w-2xl text-base leading-8 text-slate-600 md:text-lg">
                            TôHiệuQuiz giúp giáo viên tạo đề, giao bài và theo dõi tiến bộ; giúp học sinh luyện tập hứng thú; đồng thời giúp phụ huynh đồng hành rõ ràng hơn trong quá trình học tập.
                        </p>
                        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                            <button
                                type="button"
                                onClick={() => navigate('/')}
                                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 font-bold text-white shadow-lg shadow-blue-200 transition hover:-translate-y-0.5 hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
                            >
                                Bắt đầu khám phá
                                <ArrowRight className="h-5 w-5" />
                            </button>
                            <button
                                type="button"
                                onClick={() => navigate('/contact')}
                                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white px-6 font-bold text-blue-700 transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
                            >
                                <MessageCircle className="h-5 w-5" />
                                Liên hệ với chúng tôi
                            </button>
                        </div>
                    </div>

                    <div className="relative z-10 mt-12 lg:mt-0" aria-label="Minh họa bảng điều khiển học tập TôHiệuQuiz">
                        <div className="rounded-[28px] border border-blue-100 bg-[#F8FAFF] p-4 shadow-xl shadow-blue-100/70 sm:p-6">
                            <div className="mb-5 flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-widest text-blue-600">TôHiệuQuiz</p>
                                    <p className="mt-1 text-lg font-extrabold text-slate-900">Không gian học tập</p>
                                </div>
                                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-yellow-100 text-yellow-700">
                                    <Sparkles className="h-5 w-5" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                {capabilities.map((item, index) => (
                                    <div key={item.title} className={`rounded-2xl border p-4 ${index === 0 ? 'border-blue-200 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-800'}`}>
                                        <item.icon className={`h-5 w-5 ${index === 0 ? 'text-yellow-300' : 'text-blue-600'}`} />
                                        <p className="mt-5 text-sm font-bold">{item.title}</p>
                                        <div className={`mt-3 h-1.5 rounded-full ${index === 0 ? 'bg-white/25' : 'bg-slate-100'}`}>
                                            <div className={`h-full rounded-full ${index === 0 ? 'w-4/5 bg-yellow-300' : 'w-2/3 bg-blue-500'}`} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-3 flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
                                    <CheckCircle2 className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-emerald-900">Tiến bộ được ghi nhận</p>
                                    <p className="mt-0.5 text-xs text-emerald-700">Thông tin vừa đủ để kịp thời động viên người học.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section aria-labelledby="audience-heading">
                    <div className="mx-auto mb-10 max-w-3xl text-center">
                        <p className="text-sm font-bold uppercase tracking-[0.14em] text-blue-600">Một nền tảng, nhiều người đồng hành</p>
                        <h2 id="audience-heading" className="mt-3 text-3xl font-extrabold tracking-tight text-[#172554] md:text-4xl">
                            TôHiệuQuiz mang lại điều gì?
                        </h2>
                        <p className="mt-4 leading-7 text-slate-600">Mỗi nhóm người dùng có nhu cầu khác nhau, nhưng đều cần một trải nghiệm rõ ràng, nhẹ nhàng và đáng tin cậy.</p>
                    </div>
                    <div className="grid gap-6 lg:grid-cols-3">
                        {audiences.map((item) => (
                            <article key={item.title} className="group rounded-3xl border border-slate-200 bg-white p-7 shadow-[0_12px_36px_rgba(15,23,42,0.05)] transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-[0_18px_44px_rgba(37,99,235,0.10)]">
                                <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${item.accent}`}>
                                    <item.icon className="h-7 w-7" />
                                </div>
                                <h3 className="mt-6 text-xl font-extrabold text-slate-900">{item.title}</h3>
                                <p className="mt-3 leading-7 text-slate-600">{item.description}</p>
                                <ul className="mt-6 space-y-3">
                                    {item.items.map((benefit) => (
                                        <li key={benefit} className="flex items-start gap-3 text-sm font-medium text-slate-700">
                                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                                            {benefit}
                                        </li>
                                    ))}
                                </ul>
                            </article>
                        ))}
                    </div>
                </section>

                <section className="rounded-[32px] border border-blue-100 bg-blue-50/70 p-6 md:p-10" aria-labelledby="capability-heading">
                    <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
                        <div>
                            <p className="text-sm font-bold uppercase tracking-[0.14em] text-blue-600">Khả năng cốt lõi</p>
                            <h2 id="capability-heading" className="mt-2 text-3xl font-extrabold tracking-tight text-[#172554]">Hỗ trợ đúng việc, đúng lúc</h2>
                        </div>
                        <p className="max-w-xl leading-7 text-slate-600">Không chạy theo số liệu phô trương, TôHiệuQuiz tập trung vào những giá trị thực tế trong mỗi buổi học.</p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {capabilities.map((item) => (
                            <div key={item.title} className="rounded-2xl border border-white bg-white p-5 shadow-sm">
                                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                                    <item.icon className="h-5 w-5" />
                                </div>
                                <h3 className="mt-5 font-extrabold text-slate-900">{item.title}</h3>
                                <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="grid gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:items-start" aria-labelledby="journey-heading">
                    <div className="lg:sticky lg:top-28">
                        <p className="text-sm font-bold uppercase tracking-[0.14em] text-blue-600">Hành trình phát triển</p>
                        <h2 id="journey-heading" className="mt-3 text-3xl font-extrabold tracking-tight text-[#172554] md:text-4xl">Từ nhu cầu thực tế đến trải nghiệm số liền mạch</h2>
                        <p className="mt-5 leading-7 text-slate-600">Các mốc dưới đây thể hiện định hướng phát triển sản phẩm, không phải tuyên bố thành tích hay quy mô chưa được kiểm chứng.</p>
                    </div>
                    <div className="relative space-y-5 before:absolute before:bottom-6 before:left-[27px] before:top-6 before:w-px before:bg-blue-200">
                        {milestones.map((item) => (
                            <article key={item.year} className="relative flex gap-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:gap-7 sm:p-6">
                                <div className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-sm font-extrabold text-white shadow-lg shadow-blue-200">
                                    {item.year.slice(2)}
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-blue-600">{item.year}</p>
                                    <h3 className="mt-1 text-lg font-extrabold text-slate-900">{item.title}</h3>
                                    <p className="mt-2 leading-7 text-slate-600">{item.description}</p>
                                </div>
                            </article>
                        ))}
                    </div>
                </section>

                <section aria-labelledby="values-heading">
                    <div className="mb-9 max-w-2xl">
                        <p className="text-sm font-bold uppercase tracking-[0.14em] text-blue-600">Giá trị cốt lõi</p>
                        <h2 id="values-heading" className="mt-3 text-3xl font-extrabold tracking-tight text-[#172554] md:text-4xl">Thiết kế cho sự tiến bộ bền vững</h2>
                    </div>
                    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                        {values.map((item, index) => (
                            <article key={item.title} className="rounded-3xl border border-slate-200 bg-white p-6">
                                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${index === 1 ? 'bg-yellow-100 text-yellow-700' : index === 2 ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                                    <item.icon className="h-6 w-6" />
                                </div>
                                <h3 className="mt-5 text-lg font-extrabold text-slate-900">{item.title}</h3>
                                <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
                            </article>
                        ))}
                    </div>
                </section>

                <section className="relative overflow-hidden rounded-[32px] bg-[#172554] px-6 py-10 text-white shadow-xl md:px-12 md:py-14 lg:flex lg:items-center lg:justify-between lg:gap-10">
                    <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />
                    <div className="relative z-10 max-w-3xl">
                        <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-bold text-blue-100">
                            <LockKeyhole className="h-4 w-4" />
                            Học tập tích cực mỗi ngày
                        </div>
                        <h2 className="mt-5 text-3xl font-extrabold leading-tight tracking-tight md:text-4xl">Cùng xây dựng trải nghiệm học tập tích cực mỗi ngày</h2>
                        <p className="mt-4 max-w-2xl leading-7 text-blue-100">Khám phá cách TôHiệuQuiz hỗ trợ giáo viên, học sinh và phụ huynh trong một hành trình học tập liền mạch.</p>
                    </div>
                    <div className="relative z-10 mt-8 flex flex-col gap-3 sm:flex-row lg:mt-0 lg:shrink-0">
                        <button
                            type="button"
                            onClick={() => navigate('/')}
                            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-yellow-400 px-6 font-extrabold text-[#172554] transition hover:bg-yellow-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-yellow-200/50"
                        >
                            Khám phá TôHiệuQuiz
                            <ArrowRight className="h-5 w-5" />
                        </button>
                        <button
                            type="button"
                            onClick={() => navigate('/contact')}
                            className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/30 px-6 font-bold text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/30"
                        >
                            Liên hệ
                        </button>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default AboutPage;
