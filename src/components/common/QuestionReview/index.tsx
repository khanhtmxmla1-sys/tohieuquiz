import React from 'react';
import MathContent from './MathContent';
import { checkAnswer, AnswerStatus } from '../../../utils/question/scoring.util';
import { CheckCircle, XCircle, MinusCircle } from 'lucide-react';
import './QuestionReview.css';

import MCQReview from './templates/MCQReview';
import ShortAnswerReview from './templates/ShortAnswerReview';
import OrderingReview from './templates/OrderingReview';
import MatchingReview from './templates/MatchingReview';
import UnderlineReview from './templates/UnderlineReview';
import WordScrambleReview from './templates/WordScrambleReview';
import MultipleSelectReview from './templates/MultipleSelectReview';
import DragDropReview from './templates/DragDropReview';
import DropdownReview from './templates/DropdownReview';
import ErrorCorrectionReview from './templates/ErrorCorrectionReview';
import TrueFalseReview from './templates/TrueFalseReview';
import CategorizationReview from './templates/CategorizationReview';

interface QuestionReviewProps {
    index: number;
    question: any;
    studentAnswer: any;
    showExplanation?: boolean;
    status?: AnswerStatus;
}

const ReviewMap: Record<string, any> = {
    'MCQ': MCQReview,
    'IMAGE_MCQ': MCQReview,
    'IMAGE_QUESTION': MCQReview,
    'SHORT_ANSWER': ShortAnswerReview,
    'TRUE_FALSE': TrueFalseReview,
    'ORDERING': OrderingReview,
    'MATCHING': MatchingReview,
    'UNDERLINE': UnderlineReview,
    'CATEGORIZATION': CategorizationReview,
    'WORD_SCRAMBLE': WordScrambleReview,
    'RIDDLE': ShortAnswerReview,
    'MULTIPLE_SELECT': MultipleSelectReview,
    'DRAG_DROP': DragDropReview,
    'DROPDOWN': DropdownReview,
    'ERROR_CORRECTION': ErrorCorrectionReview,
};

const QuestionReview: React.FC<QuestionReviewProps> = ({
    index,
    question,
    studentAnswer,
    showExplanation = true,
    status: propStatus
}) => {
    const { status: calculatedStatus } = checkAnswer(question, studentAnswer);
    const status = propStatus || calculatedStatus;

    const getStatusIcon = () => {
        if (status === 'correct') return <CheckCircle className="status-icon correct" />;
        if (status === 'wrong') return <XCircle className="status-icon wrong" />;
        return <MinusCircle className="status-icon skipped" />;
    };

    const ReviewComponent = ReviewMap[question.type] || null;

    // Resolve question text from multiple possible field names
    const questionText = question.question || question.mainQuestion || question.questionText || question.text || '';

    return (
        <div className={`question-review-card ${status}`}>
            {/* Header: Câu X + Question text on SAME line */}
            <div className="review-header">
                <div className="question-header-content">
                    <span className="review-question-number">Câu {index + 1}:</span>
                    <MathContent content={questionText} className="question-text-inline" />
                </div>
                <div className="status-badge">
                    {getStatusIcon()}
                    <span className="status-text">
                        {status === 'correct' ? 'Đúng' : status === 'wrong' ? 'Sai' : 'Bỏ qua'}
                    </span>
                </div>
            </div>

            <div className="question-body">
                <div className="answer-section">
                    {ReviewComponent ? (
                        <ReviewComponent
                            question={question}
                            studentAnswer={studentAnswer}
                            status={status}
                        />
                    ) : (
                        <div className="student-response">
                            <strong>Câu trả lời của bạn:</strong>
                            <div className="response-value">
                                {typeof studentAnswer === 'string' ? studentAnswer : JSON.stringify(studentAnswer)}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {showExplanation && question.explanation && (
                <div className="explanation-section">
                    <div className="explanation-title">📝 Giải thích:</div>
                    <MathContent content={question.explanation} />
                </div>
            )}
        </div>
    );
};

export default QuestionReview;
