import React, { memo } from 'react';
import NewlineMathText from '../../NewlineMathText';
import { CheckCircle, XCircle } from 'lucide-react';

interface CategorizationReviewProps {
    question: any;
    studentAnswer: any; // Record<categoryName, string[]> e.g. {"Thời gian": ["Hôm qua", "Sáng nay"]}
    status: 'correct' | 'wrong' | 'skipped';
}

/**
 * CategorizationReview: Display categorization answers as category groups
 * DB stores: question.categories = [{name, items}], question.items = [strings]
 * studentAnswer = Record<categoryName, itemId[]> or similar
 */
const CategorizationReview: React.FC<CategorizationReviewProps> = memo(({ question, studentAnswer, status }) => {
    const categories = question.categories || [];
    const items = question.items || [];
    // Build correct mapping: category -> items (from question metadata)
    const correctMap: Record<string, string[]> = {};
    if (Array.isArray(categories)) {
        categories.forEach((cat: any) => {
            const catName = typeof cat === 'string' ? cat : (cat.name || cat.label || '');
            const catItems = cat.items || [];
            if (catName) correctMap[catName] = catItems;
        });
    }

    // If categories don't have their own items, try to build from correctAnswer/pairs
    const correctAnswer = question.correctAnswer || question.pairs || {};
    if (Object.keys(correctMap).every(k => correctMap[k].length === 0)) {
        if (Array.isArray(correctAnswer)) {
            // Format: [{left: item, right: cat}, ...]
            correctAnswer.forEach((pair: any) => {
                const item = pair.left;
                const cat = pair.right;
                if (item && cat) {
                    if (!correctMap[cat]) correctMap[cat] = [];
                    if (!correctMap[cat].includes(item)) correctMap[cat].push(item);
                }
            });
        } else if (typeof correctAnswer === 'object' && correctAnswer !== null) {
            // Format: {cat: [items]} or {item: cat}
            Object.entries(correctAnswer).forEach(([key, val]: [string, any]) => {
                if (Array.isArray(val)) {
                    // cat -> [items]
                    correctMap[key] = val;
                } else if (typeof val === 'string') {
                    // item -> cat
                    if (!correctMap[val]) correctMap[val] = [];
                    correctMap[val].push(key);
                }
            });
        }
    }

    // Transform studentAnswer to category -> items[] format if needed
    let response: Record<string, string[]> = {};
    if (typeof studentAnswer === 'object' && studentAnswer !== null) {
        const entries = Object.entries(studentAnswer);
        const isItemToCategory = entries.length > 0 && typeof entries[0][1] === 'string';

        if (isItemToCategory) {
            entries.forEach(([item, cat]) => {
                const catName = String(cat);
                if (!response[catName]) response[catName] = [];
                response[catName].push(item);
            });
        } else {
            response = studentAnswer as Record<string, string[]>;
        }
    }

    const categoryNames = Object.keys(correctMap).length > 0
        ? Object.keys(correctMap)
        : (Array.isArray(categories) ? categories.map((c: any) => typeof c === 'string' ? c : c.name) : Object.keys(response));

    return (
        <div className="categorization-review-template">
            <div className="categories-grid">
                {categoryNames.map((catName: string, idx: number) => {
                    const studentItems = Array.isArray(response[catName]) ? response[catName] : [];
                    const correctItems = correctMap[catName] || [];

                    return (
                        <div key={idx} className="category-column">
                            <div className="category-header">
                                <NewlineMathText content={catName} as="span" className="quiz-text-preserve-inline" />
                            </div>
                            <div className="category-items">
                                {/* Show what student placed here */}
                                {studentItems.length > 0 ? (
                                    studentItems.map((item: string, iIdx: number) => {
                                        const isCorrectPlacement = correctItems.includes(item);
                                        return (
                                            <div key={iIdx} className={`category-item ${isCorrectPlacement ? 'correct' : 'wrong'}`}>
                                                {isCorrectPlacement ? (
                                                    <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                                                ) : (
                                                    <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                                                )}
                                                <NewlineMathText content={item} as="span" className="quiz-text-preserve-inline" />
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="category-item empty">(Trống)</div>
                                )}

                                {/* Show missed correct items */}
                                {correctItems.filter(ci => !studentItems.includes(ci)).map((missed, mIdx) => (
                                    <div key={`missed-${mIdx}`} className="category-item missed">
                                        <span className="missed-label">
                                            ↳ <NewlineMathText content={missed} as="span" className="quiz-text-preserve-inline" />
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
});

export default CategorizationReview;
