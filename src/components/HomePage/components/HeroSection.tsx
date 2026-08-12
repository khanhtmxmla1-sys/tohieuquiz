import React from 'react';
import ExamManagementIcon from '../icons/ExamManagementIcon';
import LearningAnalyticsIcon from '../icons/LearningAnalyticsIcon';
import DailyPracticeIcon from '../icons/DailyPracticeIcon';
import LoginMediaSection from './login-media/LoginMediaSection';

const features = [
    { icon: ExamManagementIcon, iconName: 'exam-management', title: 'Tạo bài kiểm tra', description: 'Nhanh chóng, linh hoạt' },
    { icon: LearningAnalyticsIcon, iconName: 'learning-analytics', title: 'Theo dõi tiến bộ', description: 'Dữ liệu rõ ràng' },
    { icon: DailyPracticeIcon, iconName: 'daily-practice', title: 'Ôn luyện mỗi ngày', description: 'Theo năng lực học sinh' },
];

const HeroSection: React.FC = () => {
    return (
        <section className="order-2 w-full max-w-[700px] lg:order-1 lg:pr-2" aria-labelledby="login-hero-title">
            <div className="login-page-reveal">
                <div className="relative mb-3 aspect-[1235/571] w-[min(72vw,300px)] overflow-hidden sm:mb-4">
                    <img
                        src="/images/online-education-platform.png"
                        alt="Nền tảng giáo dục trực tuyến"
                        className="absolute inset-x-0 top-[-53.9%] h-auto w-full max-w-none"
                    />
                </div>

                <h1
                    id="login-hero-title"
                    className="max-w-[660px] text-[clamp(2rem,8vw,3.55rem)] font-bold leading-[1.08] tracking-[-0.045em] text-[#1e3a8a] sm:text-[clamp(2.25rem,6vw,3.55rem)] lg:text-[3.55rem]"
                >
                    Mỗi ngày một tiến bộ,
                    <span className="block text-[#2563eb]">mỗi bài học thêm tự tin.</span>
                </h1>

                <p className="mt-4 max-w-[620px] text-sm leading-6 text-[#475569] sm:mt-5 sm:text-[1.02rem] sm:leading-8">
                    Từ luyện tập đến kiểm tra, TôHiệuQuiz giúp học sinh nhìn thấy sự tiến bộ của mình và giúp giáo viên đồng hành hiệu quả hơn.
                </p>
            </div>

            <div className="login-page-reveal login-page-reveal-delay-1 mt-6 hidden grid-cols-1 gap-3 sm:grid sm:grid-cols-3 lg:max-w-[650px]">
                {features.map(({ icon: FeatureIcon, iconName, title, description }) => (
                    <div key={title} className="flex min-h-[76px] items-center gap-2.5 rounded-[16px] border border-[#dce5f1] bg-white/80 px-3 py-2.5">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] border border-[#dbeafe] bg-[#f5f9ff] shadow-[0_8px_20px_-18px_rgba(37,99,235,0.7)]">
                            <FeatureIcon
                                className="h-10 w-10"
                                data-login-feature-icon={iconName}
                                aria-hidden="true"
                                focusable="false"
                            />
                        </span>
                        <span>
                            <span className="block text-sm font-bold leading-5 text-[#1e293b]">{title}</span>
                            <span className="mt-0.5 block text-xs leading-5 text-[#64748b]">{description}</span>
                        </span>
                    </div>
                ))}
            </div>

            <LoginMediaSection />
        </section>
    );
};

export default HeroSection;
