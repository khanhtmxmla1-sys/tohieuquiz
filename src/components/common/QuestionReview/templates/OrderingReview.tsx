import React, { memo } from 'react';
import MathContent from '../MathContent';
import { ArrowRight } from 'lucide-react';

interface OrderingReviewProps {
    question: any;
    studentAnswer: any;
    status: 'correct' | 'wrong' | 'skipped';
}

const OrderingReview: React.FC<OrderingReviewProps> = memo(({ question, studentAnswer, status }) => {
    // Helper to get text from ID or object
    const getItemText = (id: any) => {
        const items = (question.items || question.options || []) as any[];
        const item = items.find((i: any) => {
            if (typeof i === 'string') return i === id;
            return i.id === id || i.value === id || i.text === id;
        });

        if (item) {
            return typeof item === 'string' ? item : item.text;
        }

        // Fallback to index-based lookup if id is a number and items are present
        if (typeof id === 'number' && items[id]) {
            const indexedItem = items[id];
            return typeof indexedItem === 'string' ? indexedItem : indexedItem.text;
        }

        return String(id);
    };

    const correctOrder = question.correctOrder || question.correctAnswer || [];
    const studentOrder = Array.isArray(studentAnswer) ? studentAnswer : [];

    return (
        <div className="ordering-review-template">
            <div className="order-section student-order">
                <div className="section-label">Thứ tự của bạn:</div>
                <div className="order-list">
                    {studentOrder.map((id: any, idx: number) => (
                        <div key={idx} className="order-item student">
                            <span className="index">{idx + 1}</span>
                            <MathContent content={getItemText(id)} />
                        </div>
                    ))}
                    {studentOrder.length === 0 && <div className="empty-msg">(Chưa sắp xếp)</div>}
                </div>
            </div>

            {status !== 'correct' && (
                <div className="order-section correct-order">
                    <div className="section-label">
                        <ArrowRight size={16} /> Thứ tự đúng:
                    </div>
                    <div className="order-list">
                        {correctOrder.map((id: any, idx: number) => (
                            <div key={idx} className="order-item correct">
                                <span className="index">{idx + 1}</span>
                                <MathContent content={getItemText(id)} />
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
});

export default OrderingReview;
