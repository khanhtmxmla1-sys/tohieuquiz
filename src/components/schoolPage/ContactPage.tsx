import React, { FormEvent, useState } from 'react';
import {
    ArrowRight,
    CheckCircle2,
    Clock3,
    ExternalLink,
    FileImage,
    Globe2,
    Headphones,
    HelpCircle,
    Mail,
    MapPin,
    MessageSquareText,
    MonitorCog,
    Phone,
    Send,
    ShieldCheck,
    UserRound,
    UsersRound,
} from 'lucide-react';
import { useNavigate } from 'react-router';
import PublicPageHeader from './PublicPageHeader';

const supportTopics = [
    { icon: UserRound, title: 'Tài khoản & đăng nhập', description: 'Hỗ trợ truy cập, thông tin tài khoản và phân quyền.' },
    { icon: MonitorCog, title: 'Sử dụng nền tảng', description: 'Hướng dẫn thao tác, tạo đề, giao bài và xem kết quả.' },
    { icon: UsersRound, title: 'Hợp tác & triển khai', description: 'Trao đổi nhu cầu áp dụng TôHiệuQuiz tại đơn vị.' },
];

const quickContacts = [
    {
        icon: Phone,
        title: 'Hotline hỗ trợ',
        value: '0212 388 8888',
        note: 'Thứ 2 – Thứ 6, 08:00 – 17:00',
        href: 'tel:02123888888',
        accent: 'bg-blue-50 text-blue-700',
    },
    {
        icon: Mail,
        title: 'Email hỗ trợ',
        value: 'support@thtohieu.com',
        note: 'Phù hợp khi cần gửi ảnh hoặc mô tả chi tiết',
        href: 'mailto:support@thtohieu.com',
        accent: 'bg-amber-50 text-amber-700',
    },
    {
        icon: Globe2,
        title: 'Website',
        value: 'www.thtohieu.com',
        note: 'Kênh cộng đồng sẽ được cập nhật',
        href: 'https://www.thtohieu.com',
        accent: 'bg-emerald-50 text-emerald-700',
    },
];

const faqs = [
    {
        question: 'Tôi nên chọn chủ đề hỗ trợ nào?',
        answer: 'Hãy chọn nhóm gần nhất với vấn đề của bạn. Nội dung gửi kèm sẽ giúp đội ngũ hỗ trợ chuyển yêu cầu đến đúng người phụ trách.',
    },
    {
        question: 'Bao lâu tôi sẽ nhận được phản hồi?',
        answer: 'Các yêu cầu trong giờ làm việc được ưu tiên tiếp nhận sớm. Trường hợp cần kiểm tra kỹ thuật, thời gian xử lý có thể lâu hơn và sẽ được thông báo lại.',
    },
    {
        question: 'Nên chuẩn bị gì khi báo lỗi?',
        answer: 'Bạn nên chuẩn bị ảnh chụp màn hình, tên tài khoản hoặc lớp liên quan, thiết bị đang sử dụng và các bước dẫn đến lỗi.',
    },
];

const ContactPage: React.FC = () => {
    const navigate = useNavigate();
    const [formStatus, setFormStatus] = useState('');

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setFormStatus('Đã ghi nhận yêu cầu của bạn. Tính năng gửi trực tiếp sẽ được kết nối trong phiên bản tiếp theo.');
    };

    return (
        <div className="min-h-screen bg-[#F7F9FF] font-['Be_Vietnam_Pro'] text-slate-800">
            <PublicPageHeader activePage="contact" />

            <div className="mx-auto max-w-7xl space-y-16 px-4 py-10 md:px-8 md:py-16 lg:space-y-20">
                <section className="relative overflow-hidden rounded-[32px] border border-blue-100 bg-white px-6 py-10 shadow-[0_20px_60px_rgba(30,64,175,0.08)] md:px-10 md:py-14 lg:grid lg:grid-cols-[1fr_0.9fr] lg:items-center lg:gap-12 lg:px-14">
                    <div className="pointer-events-none absolute -right-20 -top-28 h-72 w-72 rounded-full bg-blue-100/70 blur-3xl" />
                    <div className="relative z-10">
                        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700">
                            <Headphones className="h-4 w-4" />
                            Luôn sẵn sàng hỗ trợ
                        </div>
                        <h1 className="text-4xl font-extrabold leading-tight tracking-[-0.03em] text-[#172554] sm:text-5xl lg:text-6xl">
                            Kết nối với <span className="text-blue-600">TôHiệuQuiz</span>
                        </h1>
                        <p className="mt-6 max-w-2xl text-base leading-8 text-slate-600 md:text-lg">
                            Chúng tôi tiếp nhận nhu cầu hỗ trợ từ giáo viên, học sinh và phụ huynh để mỗi thao tác trên nền tảng trở nên rõ ràng, thuận tiện hơn.
                        </p>
                        <div className="mt-8 flex flex-wrap gap-4 text-sm font-semibold text-slate-600">
                            <span className="inline-flex items-center gap-2"><Clock3 className="h-4 w-4 text-blue-600" /> Thứ 2 – Thứ 6</span>
                            <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-600" /> Thông tin được tiếp nhận cẩn trọng</span>
                        </div>
                    </div>

                    <div className="relative z-10 mt-10 rounded-[28px] border border-slate-200 bg-[#F8FAFF] p-5 shadow-lg lg:mt-0 md:p-6">
                        <p className="text-sm font-bold uppercase tracking-[0.12em] text-blue-600">Bạn cần hỗ trợ về?</p>
                        <div className="mt-4 space-y-3">
                            {supportTopics.map((topic) => (
                                <a
                                    key={topic.title}
                                    href="#contact-form"
                                    className="group flex min-h-[76px] items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-blue-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
                                >
                                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 transition group-hover:bg-blue-600 group-hover:text-white">
                                        <topic.icon className="h-5 w-5" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="font-extrabold text-slate-900">{topic.title}</p>
                                        <p className="mt-1 text-sm leading-5 text-slate-600">{topic.description}</p>
                                    </div>
                                    <ArrowRight className="h-5 w-5 shrink-0 text-slate-400 transition group-hover:translate-x-1 group-hover:text-blue-600" />
                                </a>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="grid gap-5 md:grid-cols-3" aria-label="Các kênh liên hệ nhanh">
                    {quickContacts.map((contact) => (
                        <a
                            key={contact.title}
                            href={contact.href}
                            target={contact.href.startsWith('http') ? '_blank' : undefined}
                            rel={contact.href.startsWith('http') ? 'noreferrer' : undefined}
                            className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_12px_36px_rgba(15,23,42,0.05)] transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-[0_18px_44px_rgba(37,99,235,0.10)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${contact.accent}`}>
                                    <contact.icon className="h-6 w-6" />
                                </div>
                                <ExternalLink className="h-4 w-4 text-slate-400 transition group-hover:text-blue-600" />
                            </div>
                            <p className="mt-5 text-sm font-bold text-slate-500">{contact.title}</p>
                            <p className="mt-1 break-words text-lg font-extrabold text-slate-900">{contact.value}</p>
                            <p className="mt-3 text-sm leading-6 text-slate-600">{contact.note}</p>
                        </a>
                    ))}
                </section>

                <section className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]" aria-labelledby="contact-form-heading">
                    <div id="contact-form" className="scroll-mt-28 rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_16px_48px_rgba(15,23,42,0.06)] md:p-9">
                        <div className="mb-8 flex items-start gap-4">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
                                <MessageSquareText className="h-6 w-6" />
                            </div>
                            <div>
                                <p className="text-sm font-bold uppercase tracking-[0.12em] text-blue-600">Gửi yêu cầu</p>
                                <h2 id="contact-form-heading" className="mt-1 text-2xl font-extrabold text-[#172554] md:text-3xl">Chúng tôi có thể hỗ trợ bạn điều gì?</h2>
                            </div>
                        </div>

                        <form className="grid gap-5 md:grid-cols-2" onSubmit={handleSubmit}>
                            <label className="space-y-2 text-sm font-bold text-slate-700">
                                Họ và tên
                                <input
                                    type="text"
                                    name="fullName"
                                    autoComplete="name"
                                    required
                                    placeholder="Nhập họ và tên"
                                    className="h-13 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-base font-normal text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                                />
                            </label>
                            <label className="space-y-2 text-sm font-bold text-slate-700">
                                Số điện thoại
                                <input
                                    type="tel"
                                    name="phone"
                                    autoComplete="tel"
                                    required
                                    placeholder="09xx xxx xxx"
                                    className="h-13 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-base font-normal text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                                />
                            </label>
                            <label className="space-y-2 text-sm font-bold text-slate-700 md:col-span-2">
                                Email liên hệ
                                <input
                                    type="email"
                                    name="email"
                                    autoComplete="email"
                                    required
                                    placeholder="vidu@email.com"
                                    className="h-13 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-base font-normal text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                                />
                            </label>
                            <label className="space-y-2 text-sm font-bold text-slate-700 md:col-span-2">
                                Bạn cần hỗ trợ về?
                                <select
                                    name="topic"
                                    required
                                    defaultValue=""
                                    className="h-13 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-base font-normal text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                                >
                                    <option value="" disabled>Chọn một chủ đề</option>
                                    <option value="account">Tài khoản & đăng nhập</option>
                                    <option value="platform">Sử dụng nền tảng</option>
                                    <option value="partnership">Hợp tác & triển khai</option>
                                    <option value="other">Nội dung khác</option>
                                </select>
                            </label>
                            <label className="space-y-2 text-sm font-bold text-slate-700 md:col-span-2">
                                Nội dung
                                <textarea
                                    name="message"
                                    required
                                    rows={6}
                                    placeholder="Mô tả vấn đề, thao tác đã thực hiện hoặc kết quả bạn mong muốn..."
                                    className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 p-4 text-base font-normal leading-7 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                                />
                            </label>
                            <label className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-slate-600 md:col-span-2">
                                <input type="checkbox" required className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                                <span>Tôi đồng ý để TôHiệuQuiz tiếp nhận thông tin trên nhằm hỗ trợ yêu cầu này theo chính sách bảo mật.</span>
                            </label>
                            <div className="flex flex-col gap-4 md:col-span-2 sm:flex-row sm:items-center">
                                <button
                                    type="submit"
                                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-7 font-extrabold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
                                >
                                    <Send className="h-5 w-5" />
                                    Gửi yêu cầu hỗ trợ
                                </button>
                                {formStatus && (
                                    <div role="status" className="flex-1 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold leading-6 text-emerald-800">
                                        {formStatus}
                                    </div>
                                )}
                            </div>
                        </form>
                    </div>

                    <aside className="space-y-6">
                        <div className="rounded-[28px] border border-blue-100 bg-blue-50/70 p-6 md:p-7">
                            <div className="flex items-center gap-3">
                                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white">
                                    <HelpCircle className="h-5 w-5" />
                                </div>
                                <h2 className="text-xl font-extrabold text-[#172554]">Thông tin hỗ trợ</h2>
                            </div>
                            <div className="mt-6 rounded-2xl border border-blue-100 bg-white p-4">
                                <p className="text-sm font-bold text-blue-700">Thời gian phản hồi dự kiến</p>
                                <p className="mt-2 leading-6 text-slate-600">Yêu cầu được tiếp nhận trong giờ làm việc. Nội dung cần kiểm tra kỹ thuật sẽ được cập nhật tiến độ riêng.</p>
                            </div>
                            <h3 className="mt-6 font-extrabold text-slate-900">Chuẩn bị trước khi liên hệ</h3>
                            <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
                                <li className="flex gap-3"><FileImage className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" /> Ảnh chụp màn hình hoặc thông báo lỗi.</li>
                                <li className="flex gap-3"><UserRound className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" /> Tài khoản, lớp học hoặc bài tập liên quan.</li>
                                <li className="flex gap-3"><MonitorCog className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" /> Mô tả các bước thao tác trước khi xảy ra vấn đề.</li>
                            </ul>
                        </div>

                        <div className="rounded-[28px] border border-slate-200 bg-white p-6 md:p-7">
                            <h2 className="text-xl font-extrabold text-[#172554]">Câu hỏi thường gặp</h2>
                            <div className="mt-4 divide-y divide-slate-200">
                                {faqs.map((faq) => (
                                    <details key={faq.question} className="group py-4 first:pt-1">
                                        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold text-slate-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100">
                                            {faq.question}
                                            <span className="text-xl text-blue-600 transition group-open:rotate-45">+</span>
                                        </summary>
                                        <p className="mt-3 text-sm leading-6 text-slate-600">{faq.answer}</p>
                                    </details>
                                ))}
                            </div>
                        </div>
                    </aside>
                </section>

                <section className="grid overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_16px_48px_rgba(15,23,42,0.06)] lg:grid-cols-[0.92fr_1.08fr]" aria-labelledby="office-heading">
                    <div className="flex min-h-[300px] items-center justify-center bg-[radial-gradient(circle_at_30%_30%,#DBEAFE_0,#EFF6FF_35%,#F8FAFC_100%)] p-8">
                        <div className="relative flex h-44 w-44 items-center justify-center rounded-full border border-blue-200 bg-white/80 shadow-xl backdrop-blur">
                            <div className="absolute inset-5 rounded-full border border-dashed border-blue-300" />
                            <MapPin className="relative h-16 w-16 text-blue-600" />
                        </div>
                    </div>
                    <div className="flex flex-col justify-center p-7 md:p-10">
                        <p className="text-sm font-bold uppercase tracking-[0.12em] text-blue-600">Thông tin địa điểm</p>
                        <h2 id="office-heading" className="mt-2 text-2xl font-extrabold text-[#172554] md:text-3xl">Địa chỉ văn phòng đang được hoàn thiện</h2>
                        <p className="mt-4 max-w-2xl leading-7 text-slate-600">Địa chỉ văn phòng sẽ được cập nhật trước khi mở dịch vụ chính thức. Chúng tôi không hiển thị bản đồ hoặc địa điểm chưa được xác minh.</p>
                        <button
                            type="button"
                            onClick={() => navigate('/about')}
                            className="mt-7 inline-flex min-h-11 w-fit items-center gap-2 rounded-xl border border-blue-200 px-5 font-bold text-blue-700 transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
                        >
                            Xem thêm về TôHiệuQuiz
                            <ArrowRight className="h-4 w-4" />
                        </button>
                    </div>
                </section>

                <section className="relative overflow-hidden rounded-[32px] bg-[#172554] px-6 py-10 text-white shadow-xl md:px-12 md:py-14 lg:flex lg:items-center lg:justify-between lg:gap-10">
                    <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />
                    <div className="relative z-10">
                        <p className="text-sm font-bold uppercase tracking-[0.14em] text-yellow-300">Ưu tiên kênh trực tiếp</p>
                        <h2 className="mt-3 text-3xl font-extrabold tracking-tight md:text-4xl">Cần hỗ trợ gấp?</h2>
                        <p className="mt-4 max-w-2xl leading-7 text-blue-100">Gọi hotline trong giờ làm việc hoặc gửi email kèm thông tin chi tiết để chúng tôi tiếp nhận thuận tiện hơn.</p>
                    </div>
                    <div className="relative z-10 mt-8 flex flex-col gap-3 sm:flex-row lg:mt-0 lg:shrink-0">
                        <a
                            href="tel:02123888888"
                            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-yellow-400 px-6 font-extrabold text-[#172554] transition hover:bg-yellow-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-yellow-200/50"
                        >
                            <Phone className="h-5 w-5" />
                            Gọi 0212 388 8888
                        </a>
                        <a
                            href="mailto:support@thtohieu.com"
                            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/30 px-6 font-bold text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/30"
                        >
                            <Mail className="h-5 w-5" />
                            Gửi email
                        </a>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default ContactPage;
