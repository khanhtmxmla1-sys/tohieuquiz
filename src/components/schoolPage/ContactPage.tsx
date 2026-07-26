import React, { FormEvent, useState } from 'react';
import { ExternalLink, Facebook, Mail, MapPin, MessageCircle, Phone } from 'lucide-react';
import { useNavigate } from 'react-router';

const ContactPage: React.FC = () => {
    const navigate = useNavigate();
    const [formStatus, setFormStatus] = useState('');

    const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setFormStatus('Cảm ơn bạn! Tính năng gửi liên hệ sẽ được cập nhật ở phiên bản tiếp theo.');
    };

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
                            className="px-4 py-2 rounded-full text-sm font-semibold text-green-900 hover:text-emerald-600 hover:bg-green-50 transition"
                        >
                            Giới thiệu
                        </button>
                        <button
                            onClick={() => navigate('/contact')}
                            className="px-4 py-2 rounded-full text-sm font-semibold text-emerald-700 bg-green-100"
                        >
                            Liên hệ
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 md:px-8 py-10 md:py-14 space-y-10">
                <section className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-r from-emerald-600 via-green-600 to-emerald-500 text-white p-8 md:p-14 shadow-xl">
                    <div className="absolute -top-12 -right-12 w-64 h-64 rounded-full bg-white/10 blur-3xl" />
                    <div className="absolute -bottom-16 -left-10 w-48 h-48 rounded-full bg-lime-300/20 blur-2xl" />
                    <div className="relative z-10 max-w-3xl">
                        <h1 className="text-3xl md:text-5xl font-black mb-5 leading-tight tracking-tight">Kết nối với TôHiệuQuiz</h1>
                        <p className="text-green-50 text-base md:text-lg font-medium opacity-90 max-w-2xl leading-relaxed">
                            Nhà trường luôn sẵn sàng tiếp nhận thông tin từ phụ huynh và học sinh.
                            Bạn có thể gọi hotline, nhắn tin Zalo hoặc kết nối qua fanpage.
                        </p>
                    </div>
                </section>

                <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 rounded-[2.5rem] border border-green-50 bg-white p-6 md:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                                <MapPin className="w-6 h-6" />
                            </div>
                            <h2 className="text-2xl font-black text-[#064E3B]">Bản đồ trường</h2>
                        </div>
                        <div className="rounded-[2rem] overflow-hidden border border-green-100 shadow-inner">
                            <iframe
                                title="Bản đồ Mường La Sơn La"
                                className="w-full h-[400px]"
                                loading="lazy"
                                referrerPolicy="no-referrer-when-downgrade"
                                src="https://www.google.com/maps?q=Muong+La+Son+La&output=embed"
                            />
                        </div>
                    </div>

                    <div className="rounded-[2.5rem] border border-green-50 bg-white p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col justify-center space-y-4">
                        <h2 className="text-2xl font-black mb-6 text-[#064E3B]">Kênh liên hệ nhanh</h2>
                        <a
                            href="tel:02123888888"
                            className="group w-full inline-flex items-center justify-between px-6 py-4 rounded-2xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 text-emerald-800 font-bold transition-all duration-300"
                        >
                            <span className="inline-flex items-center gap-3"><Phone className="w-5 h-5 group-hover:scale-110 transition-transform" /> Hotline</span>
                            <ExternalLink className="w-4 h-4 opacity-70" />
                        </a>
                        <a
                            href="https://zalo.me"
                            target="_blank"
                            rel="noreferrer"
                            className="group w-full inline-flex items-center justify-between px-6 py-4 rounded-2xl bg-green-50 hover:bg-green-100 border border-green-100 text-green-800 font-bold transition-all duration-300"
                        >
                            <span className="inline-flex items-center gap-3"><MessageCircle className="w-5 h-5 group-hover:scale-110 transition-transform" /> Zalo nhóm</span>
                            <ExternalLink className="w-4 h-4 opacity-70" />
                        </a>
                        <a
                            href="https://facebook.com"
                            target="_blank"
                            rel="noreferrer"
                            className="group w-full inline-flex items-center justify-between px-6 py-4 rounded-2xl bg-lime-50 hover:bg-lime-100 border border-lime-100 text-[#3d5a20] font-bold transition-all duration-300"
                        >
                            <span className="inline-flex items-center gap-3"><Facebook className="w-5 h-5 group-hover:scale-110 transition-transform" /> Fanpage</span>
                            <ExternalLink className="w-4 h-4 opacity-70" />
                        </a>
                        <div className="pt-6">
                            <p className="text-xs text-slate-400 font-medium text-center">Chúng tôi sẽ phản hồi trong vòng 24 giờ làm việc.</p>
                        </div>
                    </div>
                </section>

                <section className="rounded-[2.5rem] border border-green-50 bg-white p-8 md:p-12 shadow-[0_8px_30px_rgb(0,0,0,0.04)] mb-10">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="w-12 h-12 rounded-2xl bg-green-100 text-green-600 flex items-center justify-center">
                            <Mail className="w-6 h-6" />
                        </div>
                        <h2 className="text-2xl font-black text-[#064E3B]">Gửi lời nhắn cho nhà trường</h2>
                    </div>

                    <form className="grid grid-cols-1 md:grid-cols-2 gap-6" onSubmit={handleSubmit}>
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-500 ml-1">Họ và tên</label>
                            <input
                                type="text"
                                required
                                placeholder="Nhập họ và tên của bạn..."
                                className="w-full h-14 px-6 rounded-2xl bg-slate-50 border border-transparent focus:bg-white focus:border-green-300 focus:ring-4 focus:ring-green-100 outline-none transition-all"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-500 ml-1">Số điện thoại</label>
                            <input
                                type="tel"
                                required
                                placeholder="09xx xxx xxx"
                                className="w-full h-14 px-6 rounded-2xl bg-slate-50 border border-transparent focus:bg-white focus:border-green-300 focus:ring-4 focus:ring-green-100 outline-none transition-all"
                            />
                        </div>
                        <div className="md:col-span-2 space-y-2">
                            <label className="text-sm font-bold text-slate-500 ml-1">Email liên lạc</label>
                            <input
                                type="email"
                                required
                                placeholder="vidu@email.com"
                                className="w-full h-14 px-6 rounded-2xl bg-slate-50 border border-transparent focus:bg-white focus:border-green-300 focus:ring-4 focus:ring-green-100 outline-none transition-all"
                            />
                        </div>
                        <div className="md:col-span-2 space-y-2">
                            <label className="text-sm font-bold text-slate-500 ml-1">Nội dung tin nhắn</label>
                            <textarea
                                required
                                rows={5}
                                placeholder="Ghi chú thêm về yêu cầu của bạn..."
                                className="w-full p-6 rounded-[1.8rem] bg-slate-50 border border-transparent focus:bg-white focus:border-green-300 focus:ring-4 focus:ring-green-100 outline-none resize-y transition-all"
                            />
                        </div>

                        <div className="md:col-span-2 flex flex-col sm:flex-row sm:items-center gap-6 mt-4">
                            <button
                                type="submit"
                                className="px-10 h-14 rounded-2xl bg-[#064E3B] hover:bg-emerald-700 text-white font-black text-lg transition-all shadow-lg hover:shadow-emerald-200 active:scale-95"
                            >
                                Gửi liên hệ
                            </button>
                            {formStatus && (
                                <div className="flex-1 p-4 rounded-xl bg-green-50 border border-green-100">
                                    <p className="text-sm font-bold text-emerald-800">{formStatus}</p>
                                </div>
                            )}
                        </div>
                    </form>
                </section>
            </main>
        </div>
    );
};

export default ContactPage;
