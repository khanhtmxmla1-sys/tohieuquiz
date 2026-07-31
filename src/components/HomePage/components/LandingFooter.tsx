import React from 'react';

const LandingFooter: React.FC = () => {
    return (
        <footer className="relative z-10 mt-auto w-full px-4 py-4 text-center text-xs font-medium text-[#64748b] sm:text-sm">
            <p>© {new Date().getFullYear()} TôHiệuQuiz. Đã đăng ký bản quyền.</p>
        </footer>
    );
};

export default LandingFooter;
