import React from 'react';
import { SubjectConfigItem } from '../constants/dashboard.constants';

interface SubjectGridCard extends SubjectConfigItem {
    id: string;
    total: number;
}

interface SubjectGridProps {
    subjectCards: SubjectGridCard[];
    activeTab: string;
    onCategoryClick: (catId: string) => void;
}

export const SubjectGrid: React.FC<SubjectGridProps> = ({ 
    subjectCards, 
    activeTab, 
    onCategoryClick 
}) => {
    return (
        <section id="subject-cards" className="sticker-main">
            <div className="sticker-cards">
                {subjectCards.map((subject) => (
                    <a
                        key={subject.id}
                        href={`#${subject.id}`}
                        className={`sticker-card ${activeTab === subject.id ? 'sticker-card--active' : ''} ${subject.highlight ? 'sticker-card--highlight' : ''}`}
                        onClick={(e) => {
                            e.preventDefault();
                            onCategoryClick(subject.id);
                        }}
                        style={{ '--card-color': subject.color, textDecoration: 'none' } as React.CSSProperties}
                    >
                        {/* 3D Sticker Icon */}
                        <div className="sticker-card__icon-wrap">
                            <img src={subject.icon} alt={`Ảnh minh họa môn ${subject.label}`} className="sticker-card__icon" />
                        </div>

                        {/* Label */}
                        <div className="sticker-card__label-wrap">
                            <span
                                className="sticker-card__label"
                                style={{ background: `${subject.color}15`, color: subject.color, borderColor: `${subject.color}30` }}
                            >
                                {subject.label}
                            </span>
                        </div>

                        {/* Title & Description */}
                        <h2
                            className="sticker-card__title"
                            style={subject.id === 'science' ? { fontSize: '1.8rem' } : {}}
                        >
                            {subject.title}
                        </h2>
                        <p className="sticker-card__desc">{subject.desc}</p>

                        {/* Action Button */}
                        <div
                            className={`sticker-card__btn ${subject.btnColor} ${subject.btnText}`}
                            style={{ borderBottomColor: `${subject.color}99` }}
                        >
                            {subject.btnLabel} ▶️
                        </div>
                    </a>
                ))}
            </div>
        </section>
    );
};
