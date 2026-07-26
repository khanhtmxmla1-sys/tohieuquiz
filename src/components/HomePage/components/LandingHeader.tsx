import React from 'react';
import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router';

const LandingHeader: React.FC = () => {
    const navigate = useNavigate();

    return (
        <header className="px-5 md:px-12 py-5 flex items-center justify-between z-10">
            {/* Logo */}
            <div 
                className="flex items-center gap-2.5 cursor-pointer" 
                onClick={() => navigate('/')}
            >
                <img
                    src="/favicon.svg"
                    alt="TôHiệuQuiz"
                    className="w-11 h-11 object-contain"
                />
                <span className="font-extrabold text-[1.4rem]">
                    <span className="text-[#1e3a8a]">TôHiệu</span>
                    <span className="text-[#FACC15]">Quiz</span>
                </span>
            </div>

            {/* Nav & CTA */}
            <div className="flex items-center gap-8 header-nav-container">
                <nav className="hidden md:flex gap-6">
                    <button className="font-baloo font-semibold text-[#1e3a8a] hover:text-[#2563eb] text-base transition-colors" onClick={() => navigate('/')}>Trang chủ</button>
                    <button className="font-baloo font-semibold text-[#1e3a8a] hover:text-[#2563eb] text-base transition-colors" onClick={() => navigate('/about')}>Giới thiệu</button>
                    <button className="font-baloo font-semibold text-[#1e3a8a] hover:text-[#2563eb] text-base transition-colors" onClick={() => navigate('/contact')}>Liên hệ</button>
                </nav>
                <button
                    className="bg-white text-[#16a34a] rounded-full px-[18px] py-2 font-baloo font-bold text-[0.95rem] cursor-pointer flex items-center gap-1.5 transition-all shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-95"
                    onClick={() => navigate('/')}
                >
                    Bắt đầu <ArrowRight size={16} />
                </button>
            </div>
        </header>
    );
};

export default LandingHeader;
