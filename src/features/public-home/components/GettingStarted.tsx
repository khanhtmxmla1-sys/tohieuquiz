import React from 'react';
import { ArrowRight, GraduationCap, HeartHandshake, School } from 'lucide-react';
import { Link } from 'react-router';
import { gettingStartedSteps } from '../publicHomeLanding.content';

const GettingStarted: React.FC = () => (
    <section id="bat-dau" className="public-home__section public-home__getting-started">
        <div className="public-home__container">
            <div className="public-home__section-heading">
                <p className="public-home__section-kicker">Bắt đầu thật đơn giản</p>
                <h2>Sẵn sàng đồng hành cùng TôHiệuQuiz?</h2>
                <p>Chọn đúng khu vực để bắt đầu trải nghiệm theo vai trò của bạn.</p>
            </div>
            <div className="public-home__steps">
                {gettingStartedSteps.map((step) => (
                    <article key={step.number}>
                        <span>{step.number}</span>
                        <h3>{step.title}</h3>
                        <p>{step.description}</p>
                    </article>
                ))}
            </div>
            <div className="public-home__role-actions" aria-label="Chọn vai trò để vào hệ thống">
                <Link className="public-home__role-link public-home__role-link--student" to="/?login=student">
                    <GraduationCap aria-hidden="true" />
                    <span>Học sinh<small>Vào khu vực học tập</small></span>
                    <ArrowRight aria-hidden="true" />
                </Link>
                <Link className="public-home__role-link public-home__role-link--teacher" to="/?login=teacher">
                    <School aria-hidden="true" />
                    <span>Giáo viên<small>Quản lý lớp và bài kiểm tra</small></span>
                    <ArrowRight aria-hidden="true" />
                </Link>
                <a className="public-home__role-link public-home__role-link--parent" href="https://phuhuynh.thtohieu.com/login">
                    <HeartHandshake aria-hidden="true" />
                    <span>Phụ huynh<small>Mở Cổng phụ huynh</small></span>
                    <ArrowRight aria-hidden="true" />
                </a>
            </div>
        </div>
    </section>
);

export default GettingStarted;
