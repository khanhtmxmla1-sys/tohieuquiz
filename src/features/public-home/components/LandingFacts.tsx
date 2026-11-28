import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { facts } from '../publicHomeLanding.content';

const LandingFacts: React.FC = () => (
    <section id="so-lieu" className="public-home__section public-home__facts">
        <div className="public-home__container">
            <div className="public-home__section-heading">
                <p className="public-home__section-kicker">Năng lực trên hệ thống</p>
                <h2>Một nền tảng vừa đủ rõ ràng để bắt đầu</h2>
                <p>Những điểm cốt lõi đã được thiết kế để phù hợp với nhịp học tập và kiểm tra ở tiểu học.</p>
            </div>
            <div className="public-home__facts-grid">
                {facts.map((fact) => (
                    <article key={fact.value} className="public-home__fact-card">
                        <CheckCircle2 aria-hidden="true" />
                        <strong>{fact.value}</strong>
                        <span>{fact.label}</span>
                    </article>
                ))}
            </div>
            <p className="public-home__facts-note">Thông tin chi tiết về tính năng và hoạt động được cập nhật theo từng khu vực của hệ thống.</p>
        </div>
    </section>
);

export default LandingFacts;
