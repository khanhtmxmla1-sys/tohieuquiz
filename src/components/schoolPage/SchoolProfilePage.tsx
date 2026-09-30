import React from 'react';
import { useNavigate } from 'react-router';
import {
    BRAND_RELATIONSHIP_LINE,
    SCHOOL_IDENTIFIER,
    SCHOOL_LOCATION_LABEL,
    SCHOOL_NAME,
    SCHOOL_OFFICIAL_EMAIL,
} from '../../config/schoolIdentity';
import PublicPageHeader from './PublicPageHeader';

const SchoolProfilePage: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-[#F7F9FF] font-['Be_Vietnam_Pro'] text-slate-800">
            <PublicPageHeader activePage="school" />
            <div className="mx-auto max-w-6xl px-4 py-10 md:px-8 md:py-16">
                <section className="rounded-[32px] border border-blue-100 bg-white p-7 shadow-[0_20px_60px_rgba(30,64,175,0.08)] md:p-12">
                    <p className="text-sm font-bold uppercase tracking-[0.14em] text-blue-600">
                        Giáo dục tiểu học · Sơn La
                    </p>
                    <h1 className="mt-3 text-4xl font-extrabold tracking-[-0.03em] text-[#172554] md:text-5xl">
                        Trường Tiểu học Tô Hiệu – Sơn La
                    </h1>
                    <p className="mt-5 max-w-3xl text-base leading-8 text-slate-600 md:text-lg">
                        {SCHOOL_NAME} là cơ sở giáo dục công lập thuộc {SCHOOL_LOCATION_LABEL}.
                        Trang này cung cấp thông tin nhận diện thống nhất của nhà trường và mối liên hệ
                        với nền tảng học tập TôHiệuQuiz.
                    </p>

                    <dl className="mt-8 grid gap-4 sm:grid-cols-2">
                        <div className="rounded-2xl bg-blue-50 p-5">
                            <dt className="font-bold text-blue-900">Đơn vị</dt>
                            <dd className="mt-1 text-slate-700">{SCHOOL_NAME}</dd>
                        </div>
                        <div className="rounded-2xl bg-blue-50 p-5">
                            <dt className="font-bold text-blue-900">Địa bàn</dt>
                            <dd className="mt-1 text-slate-700">{SCHOOL_LOCATION_LABEL}</dd>
                        </div>
                        <div className="rounded-2xl bg-blue-50 p-5">
                            <dt className="font-bold text-blue-900">Mã định danh</dt>
                            <dd className="mt-1 text-slate-700">{SCHOOL_IDENTIFIER}</dd>
                        </div>
                        <div className="rounded-2xl bg-blue-50 p-5">
                            <dt className="font-bold text-blue-900">Email cơ quan</dt>
                            <dd className="mt-1 text-slate-700">{SCHOOL_OFFICIAL_EMAIL}</dd>
                        </div>
                    </dl>
                </section>

                <section className="mt-8 rounded-[28px] border border-blue-100 bg-white p-7 md:p-10">
                    <h2 className="text-2xl font-extrabold text-[#172554]">TôHiệuQuiz và hoạt động học tập số</h2>
                    <p className="mt-4 max-w-3xl leading-7 text-slate-600">{BRAND_RELATIONSHIP_LINE}.</p>
                    <p className="mt-3 max-w-3xl leading-7 text-slate-600">
                        Nội dung quiz theo mã đề hoặc tài khoản học sinh không được công khai cho công cụ tìm kiếm.
                    </p>
                    <div className="mt-6 flex flex-wrap gap-3">
                        <button
                            type="button"
                            onClick={() => navigate('/about')}
                            className="min-h-11 rounded-xl bg-blue-600 px-5 font-bold text-white"
                        >
                            Giới thiệu TôHiệuQuiz
                        </button>
                        <button
                            type="button"
                            onClick={() => navigate('/contact')}
                            className="min-h-11 rounded-xl border border-blue-200 px-5 font-bold text-blue-700"
                        >
                            Liên hệ
                        </button>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default SchoolProfilePage;
