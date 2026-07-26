import React from 'react';
import { Globe, Mail } from 'lucide-react';
import { SCHOOL_NAME } from '../../config/constants';

export type FooterRoutePath = '/' | '/about' | '/contact' | '/privacy' | '/tos';

interface Props {
    onNavigate: (path: FooterRoutePath) => void;
    showPublicLinks?: boolean;
}

const Footer: React.FC<Props> = ({ onNavigate, showPublicLinks = true }) => {
    const currentYear = new Date().getFullYear();

    return (
        <footer 
            className="relative pt-16 pb-12 px-6 overflow-hidden"
            style={{ 
                fontFamily: "'Baloo 2', sans-serif",
                background: 'rgba(220, 252, 231, 0.6)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                borderTop: '1px solid rgba(255, 255, 255, 0.3)'
            }}
        >
            {/* Decorative leaf patterns (optional/subtle) */}
            <div className="absolute top-0 left-0 w-32 h-32 opacity-5 pointer-events-none transform -translate-x-1/2 -translate-y-1/2 bg-green-900 rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 right-0 w-48 h-48 opacity-5 pointer-events-none transform translate-x-1/3 translate-y-1/3 bg-green-800 rounded-full blur-3xl"></div>

            <div className="max-w-7xl mx-auto relative z-10">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
                    {/* Brand Section */}
                    <div className="flex flex-col gap-6">
                        <div 
                            className="flex items-center gap-2 cursor-pointer transition-transform hover:scale-105 active:scale-95 origin-left"
                            onClick={() => onNavigate('/')}
                        >
                            <img 
                                src="/favicon.svg" 
                                alt="logo" 
                                className="w-10 h-10 object-contain"
                                onError={(e) => { (e.target as HTMLImageElement).src = '/favicon.svg'; }}
                            />
                            <span className="text-2xl font-extrabold tracking-tight">
                                <span style={{ color: '#1e3a8a' }}>TôHiệu</span><span style={{ color: '#0EA5E9' }}>Quiz</span>
                            </span>
                        </div>
                        <p className="text-emerald-900/80 text-sm font-medium leading-relaxed max-w-xs">
                            Khơi dậy tiềm năng tri thức. Nền tảng luyện tập thông minh giúp học sinh tiểu học ôn luyện hứng thú mỗi ngày.
                        </p>
                        <div className="flex gap-4">
                            {[
                                { icon: Globe, href: "https://www.thtohieu.com", label: "Website" },
                                { icon: Mail, href: "mailto:support@thtohieu.com", label: "Email" }
                            ].map((social, idx) => (
                                <a 
                                    key={idx} 
                                    href={social.href}
                                    className="p-3 bg-white/40 hover:bg-white/80 text-emerald-900 rounded-2xl transition-all duration-300 shadow-sm backdrop-blur-md group"
                                    aria-label={social.label}
                                >
                                    <social.icon className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                </a>
                            ))}
                        </div>
                    </div>

                    {/* Discovery Links */}
                    <div>
                        <h4 className="text-sm font-extrabold text-emerald-900 uppercase tracking-widest mb-8 flex items-center gap-2">
                             Khám phá
                        </h4>
                        <ul className="space-y-4">
                            {[
                                { name: 'Trang chủ', path: '/', show: showPublicLinks },
                                { name: 'Giới thiệu', path: '/about', show: showPublicLinks },
                                { name: 'Liên hệ', path: '/contact', show: showPublicLinks },
                                { name: 'Kho ứng dụng', path: null, show: true },
                                { name: 'Bảng xếp hạng', path: null, show: true }
                            ].map((item, idx) => (
                                item.show && (
                                    <li key={idx}>
                                        <button 
                                            onClick={() => item.path && onNavigate(item.path as FooterRoutePath)}
                                            className="text-emerald-800/80 hover:text-emerald-900 text-[0.95rem] font-semibold transition-all hover:translate-x-1 flex items-center gap-2"
                                        >
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity"></span>
                                            {item.name}
                                        </button>
                                    </li>
                                )
                            ))}
                        </ul>
                    </div>

                    {/* Legal Links */}
                    <div>
                        <h4 className="text-sm font-extrabold text-emerald-900 uppercase tracking-widest mb-8">
                            Hỗ trợ & Pháp lý
                        </h4>
                        <ul className="space-y-4">
                            {[
                                { name: 'Chính sách bảo mật', path: '/privacy' },
                                { name: 'Điều khoản sử dụng', path: '/tos' },
                                { name: 'Trợ giúp (Trợ lý AI)', path: null }
                            ].map((item, idx) => (
                                <li key={idx}>
                                    <button 
                                        onClick={() => item.path && onNavigate(item.path as FooterRoutePath)}
                                        className="text-emerald-800/80 hover:text-emerald-900 text-[0.95rem] font-semibold transition-all hover:translate-x-1"
                                    >
                                        {item.name}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* contact info */}
                    <div>
                        <h4 className="text-sm font-extrabold text-emerald-900 uppercase tracking-widest mb-8">
                            Nền tảng
                        </h4>
                        <div className="bg-white/30 p-5 rounded-3xl backdrop-blur-lg border border-white/40 shadow-sm transition-transform hover:-rotate-1">
                            <p className="text-emerald-900 text-sm font-bold mb-2 flex items-center gap-2">
                                {SCHOOL_NAME}
                            </p>
                            <p className="text-emerald-800/70 text-xs leading-relaxed font-semibold mb-4">
                                Thông tin doanh nghiệp và địa chỉ hỗ trợ sẽ được cập nhật trước khi mở bán.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
