import React from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { Link } from 'react-router';
import { competitionRounds } from '../publicHomeLanding.content';

const CompetitionHighlights: React.FC = () => (
    <section id="trang-nguyen" className="public-home__section public-home__competition">
        <div className="public-home__container public-home__competition-grid">
            <div>
                <p className="public-home__section-kicker">Sân chơi học thuật</p>
                <h2>Trạng Nguyên Nhí — học tập thêm hào hứng</h2>
                <p className="public-home__section-lead">
                    Một không gian thi đua tích cực để học sinh rèn kiến thức, sự tập trung và tinh thần vượt qua thử thách. Thông tin vòng thi và thể lệ được cập nhật tại cổng cuộc thi.
                </p>
                <div className="public-home__competition-pills">
                    <span><Check aria-hidden="true" />Theo từng chặng thử thách</span>
                    <span><Check aria-hidden="true" />Ghi nhận nỗ lực học tập</span>
                    <span><Check aria-hidden="true" />Có bảng kết quả và chứng nhận</span>
                </div>
                <Link className="public-home__button public-home__button--secondary" to="/cuoc-thi">
                    Xem cổng cuộc thi <ArrowRight aria-hidden="true" />
                </Link>
            </div>
            <div className="public-home__competition-side">
                <img
                    src="/assets/landing/v1/competition-1200.webp"
                    srcSet="/assets/landing/v1/competition-640.webp 640w, /assets/landing/v1/competition-1200.webp 1200w"
                    sizes="(max-width: 900px) 92vw, 520px"
                    width={1200}
                    height={800}
                    alt="Học sinh tiểu học vui mừng trong một hoạt động thi đua học tập"
                    loading="lazy"
                    decoding="async"
                />
                <p className="public-home__illustration-note">Minh họa hành trình học tập; vòng thi và thể lệ hiện hành xem tại cổng cuộc thi.</p>
                <ol className="public-home__rounds">
                    {competitionRounds.map((round, index) => (
                        <li key={round.title}>
                            <span>{String(index + 1).padStart(2, '0')}</span>
                            <div>
                                <strong>{round.title}</strong>
                                <p>{round.description}</p>
                            </div>
                        </li>
                    ))}
                </ol>
            </div>
        </div>
    </section>
);

export default CompetitionHighlights;
