import React from 'react';

interface Feature {
  avatar: string;
  text: React.ReactNode;
}

const HeroSection: React.FC = () => {
    const features: Feature[] = [
        { avatar: "/avatar1.webp", text: <>Ngân hàng <strong>10,000+</strong> câu hỏi trắc nghiệm đa dạng.</> },
        { avatar: "/avatar2.webp", text: <>Báo cáo điểm số, <strong>thống kê chi tiết</strong> tự động.</> },
        { avatar: "/avatar3.webp", text: <>Giao diện <strong>điều khiển trực quan</strong>, dễ dùng cho mọi người.</> },
    ];

    return (
        <section className="flex-1 max-w-[540px] bg-transparent flex flex-col gap-8 text-left md:text-left items-center md:items-start w-full">
            <div className="hero-text text-center md:text-left">
                <h1 className="text-[4.2rem] font-extrabold leading-[1.1] text-[#1e3a8a] mb-5 sm:text-4xl md:text-6xl lg:text-[4.2rem]">
                    Khơi Dậy Tiềm Năng Tri Thức
                </h1>
                <p className="text-[1.05rem] text-slate-800 leading-[1.6] max-w-[460px] font-medium m-0">
                    Nền tảng kiểm tra trực tuyến thông minh, giúp giáo viên quản lý lớp học hiệu quả và học sinh ôn luyện hứng thú mỗi ngày.
                </p>
            </div>

            <div className="hidden md:flex flex-col gap-5 w-full">
                {features.map((f, i) => (
                    <div 
                        key={i} 
                        className="flex items-center gap-4 bg-transparent hover:bg-white/85 hover:translate-y-[-5px] hover:scale-[1.03] hover:shadow-xl border border-transparent hover:border-white/90 rounded-[24px] p-2.5 transition-all duration-300 cursor-pointer pointer-events-auto"
                    >
                        <img 
                            src={f.avatar} 
                            alt={`Feature aspect ${i+1}`}
                            className="w-12 h-12 rounded-full object-cover bg-white shadow-sm border-2 border-white" 
                        />
                        <span className="flex-1 text-slate-800 font-medium">{f.text}</span>
                    </div>
                ))}
            </div>
        </section>
    );
};

export default HeroSection;
