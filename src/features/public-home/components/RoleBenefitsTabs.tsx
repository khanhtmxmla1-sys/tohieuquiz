import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { roleBenefits } from '../publicHomeLanding.content';

const RoleBenefitsTabs: React.FC = () => {
    const [activeId, setActiveId] = useState(roleBenefits[0].id);
    const onTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
        let nextIndex: number | undefined;
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (index + 1) % roleBenefits.length;
        if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (index - 1 + roleBenefits.length) % roleBenefits.length;
        if (event.key === 'Home') nextIndex = 0;
        if (event.key === 'End') nextIndex = roleBenefits.length - 1;
        if (nextIndex === undefined) return;
        event.preventDefault();
        const next = roleBenefits[nextIndex];
        setActiveId(next.id);
        document.getElementById(`public-home-tab-${next.id}`)?.focus();
    };

    return (
        <section id="loi-ich" className="public-home__section public-home__section--tint-warm">
            <div className="public-home__container">
                <div className="public-home__section-heading">
                    <p className="public-home__section-kicker">Lợi ích theo từng vai trò</p>
                    <h2>Mỗi người một góc nhìn, cùng một mục tiêu</h2>
                    <p>Chọn vai trò để xem TôHiệuQuiz hỗ trợ việc học và việc dạy như thế nào.</p>
                </div>
                <div className="public-home__tabs" role="tablist" aria-label="Lợi ích theo vai trò">
                    {roleBenefits.map((benefit, index) => (
                        <button
                            key={benefit.id}
                            id={`public-home-tab-${benefit.id}`}
                            type="button"
                            role="tab"
                            aria-selected={activeId === benefit.id}
                            aria-controls={`public-home-panel-${benefit.id}`}
                            tabIndex={activeId === benefit.id ? 0 : -1}
                            onClick={() => setActiveId(benefit.id)}
                            onKeyDown={(event) => onTabKeyDown(event, index)}
                        >
                            {benefit.label}
                        </button>
                    ))}
                </div>
                {roleBenefits.map((benefit) => (
                    <div key={benefit.id} id={`public-home-panel-${benefit.id}`} className="public-home__tab-panel" role="tabpanel" aria-labelledby={`public-home-tab-${benefit.id}`} hidden={activeId !== benefit.id}>
                        {benefit.image ? (
                            <div className="public-home__tab-media">
                                <img
                                    src={benefit.image}
                                    srcSet={`${benefit.imageSmall ?? benefit.image} 640w, ${benefit.image} 960w`}
                                    sizes="(max-width: 640px) 92vw, (max-width: 950px) 84vw, 500px"
                                    alt={benefit.imageAlt}
                                    width={960}
                                    height={640}
                                    loading="lazy"
                                    decoding="async"
                                />
                            </div>
                        ) : <div className="public-home__tab-placeholder" aria-hidden="true">TôHiệuQuiz</div>}
                        <div className="public-home__tab-copy">
                            <h3>{benefit.title}</h3>
                            <p>{benefit.description}</p>
                            <ul>
                                {benefit.bullets.map((bullet) => <li key={bullet}><Check aria-hidden="true" />{bullet}</li>)}
                            </ul>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
};

export default RoleBenefitsTabs;
