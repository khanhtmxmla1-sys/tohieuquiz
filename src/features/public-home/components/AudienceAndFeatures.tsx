import React from 'react';
import { BookOpen, Check, GraduationCap, UsersRound } from 'lucide-react';
import { audiences, features } from '../publicHomeLanding.content';

const audienceIcons = { teacher: GraduationCap, student: BookOpen, parent: UsersRound } as const;

interface AudienceAndFeaturesProps {
    giftShopEnabled?: boolean;
}

const AudienceAndFeatures: React.FC<AudienceAndFeaturesProps> = ({ giftShopEnabled = false }) => {
    const visibleFeatures = giftShopEnabled
        ? features
        : features.filter((feature) => feature.eyebrow !== 'Động lực học tập');

    return (
        <>
            <section id="doi-tuong" className="public-home__section">
                <div className="public-home__container">
                    <div className="public-home__section-heading">
                        <p className="public-home__section-kicker">Một hệ thống, nhiều người cùng hưởng lợi</p>
                        <h2>Học tập hiệu quả hơn khi mọi người cùng kết nối</h2>
                        <p>TôHiệuQuiz tạo thành một vòng học tập khép kín: ra đề — làm bài — phản hồi — khích lệ — đồng hành.</p>
                    </div>
                    <div className="public-home__audience-grid">
                        {audiences.map((audience) => {
                            const Icon = audienceIcons[audience.icon];
                            return (
                                <article className="public-home__audience-card" key={audience.title}>
                                    <span className={`public-home__audience-icon public-home__audience-icon--${audience.icon}`}>
                                        <Icon aria-hidden="true" />
                                    </span>
                                    <p className="public-home__card-kicker">{audience.eyebrow}</p>
                                    <h3>{audience.title}</h3>
                                    <p>{audience.description}</p>
                                    <ul>
                                        {audience.bullets.map((bullet) => (
                                            <li key={bullet}><Check aria-hidden="true" />{bullet}</li>
                                        ))}
                                    </ul>
                                </article>
                            );
                        })}
                    </div>
                </div>
            </section>

            <section id="tinh-nang" className="public-home__section public-home__section--tint">
                <div className="public-home__container">
                    <div className="public-home__section-heading">
                        <p className="public-home__section-kicker">Tính năng nổi bật</p>
                        <h2>Mọi thao tác quan trọng đều rõ ràng</h2>
                        <p>Thiết kế thân thiện để thầy cô dễ bắt đầu, học sinh dễ sử dụng và phụ huynh dễ đồng hành.</p>
                    </div>
                    <div className="public-home__feature-list">
                        {visibleFeatures.map((feature, index) => (
                            <article className={`public-home__feature-row ${index % 2 ? 'public-home__feature-row--reverse' : ''}`} key={feature.title}>
                                <div className={`public-home__feature-media public-home__feature-media--${feature.tone}`}>
                                    {feature.image ? (
                                        <img src={feature.image} alt={feature.imageAlt} width={1275} height={index === 1 ? 620 : 1000} loading="lazy" decoding="async" />
                                    ) : null}
                                </div>
                                <div className="public-home__feature-copy">
                                    <p className="public-home__card-kicker">{feature.eyebrow}</p>
                                    <h3>{feature.title}</h3>
                                    <p>{feature.description}</p>
                                    <ul>
                                        {feature.bullets.map((bullet) => (
                                            <li key={bullet}><Check aria-hidden="true" />{bullet}</li>
                                        ))}
                                    </ul>
                                </div>
                            </article>
                        ))}
                    </div>
                </div>
            </section>
        </>
    );
};

export default AudienceAndFeatures;
