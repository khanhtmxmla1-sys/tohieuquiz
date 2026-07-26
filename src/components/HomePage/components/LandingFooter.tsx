import React from 'react';

const LandingFooter: React.FC = () => {
    return (
        <footer className="w-full px-8 py-4 text-center text-[0.85rem] text-[#1e293b] font-medium relative mt-auto border-t border-white/20 sm:border-t-0">
            <p>© {new Date().getFullYear()} TôHiệuQuiz. All rights reserved.</p>
        </footer>
    );
};

export default LandingFooter;
