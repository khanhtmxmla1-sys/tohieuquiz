import React from 'react';
import { Award, Building2, CalendarDays, Flag, School, Sparkles, Trophy } from 'lucide-react';
import { useNavigate } from 'react-router';

const milestones = [
    { year: '2016', title: 'Khởi động hành trình', desc: 'Trường bắt đầu xây dựng môi trường học tập thân thiện và sáng tạo.' },
    { year: '2019', title: 'Nâng cấp cơ sở vật chất', desc: 'Hoàn thiện phòng học thông minh, thư viện mở và không gian trải nghiệm.' },
    { year: '2023', title: 'Đẩy mạnh chuyển đổi số', desc: 'Ứng dụng nền tảng học tập trực tuyến và đánh giá tiến bộ theo năng lực.' },
    { year: '2026', title: 'Hướng tới trường học hạnh phúc', desc: 'Tập trung vào trải nghiệm học sinh, kết nối phụ huynh và cộng đồng.' },
];

const gallery = [
    'Ngày hội đọc sách',
    'Sân chơi STEM',
    'Hoạt động ngoại khóa',
    'Giờ học sáng tạo',
    'Lễ tổng kết năm học',
    'CLB văn nghệ',
];

const achievements = [
    'Top phong trào đổi mới dạy học cấp huyện',
    'Nhiều học sinh đạt giải cấp huyện, cấp tỉnh',
    'Liên tục đạt tập thể lao động tiên tiến',
];

const AboutPage: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-[#F8FAF9] font-['Baloo_2'] text-slate-800">
            <header className="sticky top-0 z-30 backdrop-blur-xl bg-white/70 border-b border-green-100">
                <div className="max-w-7xl mx-auto px-4 md:px-8 h-18 flex items-center justify-between">
                    <button
                        onClick={() => navigate('/')}
                        className="font-black text-[#064E3B] tracking-tight text-xl hover:text-green-600 transition-colors"
                    >
                        ÍtOng<span className="text-orange-500">Quiz</span>
                    </button>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => navigate('/')}
                            className="px-4 py-2 rounded-full text-sm font-semibold text-green-900 hover:text-emerald-600 hover:bg-green-50 transition"
                        >
                            Trang chủ
                        </button>
                        <button
                            onClick={() => navigate('/about')}
                            className="px-4 py-2 rounded-full text-sm font-semibold text-emerald-700 bg-green-100"
                        >
                            Giới thiệu
                        </button>
                        <button
                            onClick={() => navigate('/contact')}
                            className="px-4 py-2 rounded-full text-sm font-semibold text-green-900 hover:text-emerald-600 hover:bg-green-50 transition"
                        >
                            Liên hệ
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 md:px-8 py-10 md:py-14 space-y-12">
                <section className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-r from-emerald-600 via-green-600 to-lime-500 p-8 md:p-14 text-white shadow-xl">
                    <div className="absolute -top-16 -right-12 w-64 h-64 rounded-full bg-white/20 blur-3xl animate-pulse" />
                    <div className="absolute -bottom-16 -left-10 w-48 h-48 rounded-full bg-lime-300/30 blur-2xl" />
                    <div className="relative z-10 max-w-3xl">
                        <p className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/20 text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] mb-6 backdrop-blur-md">
                            <Sparkles className="w-3.5 h-3.5" />
                            Giới thiệu nhà trường
                        </p>
                        <h1 className="text-4xl md:text-6xl font-black leading-tight mb-6 tracking-tight">
                            TôHiệuQuiz
                        </h1>
                        <p className="text-green-50 text-base md:text-xl leading-relaxed font-medium opacity-90">
                            Chúng tôi xây dựng môi trường học tập an toàn, nhân ái và truyền cảm hứng.
                            Học sinh được tôn trọng sự khác biệt, được khuyến khích sáng tạo và phát triển toàn diện.
                        </p>
                    </div>
                </section>

                <section className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
                    {[
                        { icon: School, title: 'Tầm nhìn', desc: 'Đào tạo thế hệ học sinh tự tin, có kỹ năng học tập suốt đời.', color: 'bg-emerald-100 text-emerald-600' },
                        { icon: Flag, title: 'Sứ mệnh', desc: 'Kết hợp nền tảng số và phương pháp dạy học tích cực vì học sinh.', color: 'bg-green-100 text-green-600' },
                        { icon: Building2, title: 'Giá trị cốt lõi', desc: 'Tôn trọng, hợp tác, kỷ luật tích cực, trách nhiệm và sáng tạo.', color: 'bg-lime-100 text-emerald-700' }
                    ].map((item, idx) => (
                        <div key={idx} className="rounded-[2.5rem] bg-white border border-green-50 p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-lg transition-all duration-300 group">
                            <div className={`w-14 h-14 rounded-2xl ${item.color} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                                <item.icon className="w-7 h-7" />
                            </div>
                            <h3 className="font-black text-2xl mb-3 text-[#064E3B]">{item.title}</h3>
                            <p className="text-slate-600 text-base leading-relaxed">{item.desc}</p>
                        </div>
                    ))}
                </section>

                <section className="rounded-[2.5rem] bg-white border border-green-50 p-8 md:p-12 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                    <div className="flex items-center gap-4 mb-10">
                        <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center">
                            <CalendarDays className="w-6 h-6" />
                        </div>
                        <h2 className="text-3xl font-black text-[#064E3B]">Hành trình phát triển</h2>
                    </div>
                    <div className="space-y-6">
                        {milestones.map((item) => (
                            <div key={item.year} className="flex flex-col md:flex-row gap-4 md:gap-8 group">
                                <div className="w-24 shrink-0 text-xl font-black text-emerald-600 pt-1">{item.year}</div>
                                <div className="flex-1 rounded-[1.8rem] bg-[#F0FDF4]/50 border border-green-100 p-6 group-hover:bg-[#F0FDF4] transition-colors">
                                    <h3 className="font-bold text-lg text-slate-800 mb-2">{item.title}</h3>
                                    <p className="text-base text-slate-600 leading-relaxed">{item.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="rounded-[2.5rem] bg-white border border-green-50 p-8 md:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="w-12 h-12 rounded-2xl bg-yellow-100 text-yellow-600 flex items-center justify-center">
                                <Trophy className="w-6 h-6" />
                            </div>
                            <h2 className="text-2xl font-black text-[#064E3B]">Bảng vàng thành tích</h2>
                        </div>
                        <ul className="space-y-4">
                            {achievements.map((item) => (
                                <li key={item} className="flex items-start gap-4 text-base text-slate-700 bg-slate-50/50 p-4 rounded-2xl border border-transparent hover:border-green-100 transition-all">
                                    <Award className="w-5 h-5 mt-0.5 text-amber-500 shrink-0" />
                                    <span className="font-medium">{item}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="rounded-[2.5rem] bg-white border border-green-50 p-8 md:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                        <h2 className="text-2xl font-black mb-8 text-[#064E3B]">Thư viện hình ảnh</h2>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {gallery.map((item) => (
                                <div
                                    key={item}
                                    className="aspect-square rounded-[1.5rem] border border-green-100 bg-gradient-to-br from-green-50 to-emerald-50 p-4 flex items-end hover:shadow-md transition-shadow cursor-default"
                                >
                                    <p className="text-[11px] md:text-xs font-bold text-emerald-800 leading-snug">{item}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
};

export default AboutPage;
