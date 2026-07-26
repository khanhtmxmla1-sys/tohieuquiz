import React, { useRef, useLayoutEffect } from 'react';
import { Question, QuestionType } from '../../../../types';
import { Check, X, Minus, ChevronRight, HelpCircle } from 'lucide-react';
import { formatMathText } from '../../../../utils/formatters';

import { MathSpan } from '../../../common';

export type AnswerStatus = 'correct' | 'wrong' | 'skipped';

interface Props {
    question: Question;
    questionNumber: number;
    status: AnswerStatus;
    studentAnswer: any;
    onClick?: () => void;
    isExpanded?: boolean;
}

const AnswerCard: React.FC<Props> = ({
    question,
    questionNumber,
    status,
    studentAnswer,
    onClick,
    isExpanded = false
}) => {
    // Get styling based on status
    const getStatusConfig = () => {
        switch (status) {
            case 'correct':
                return {
                    borderColor: 'border-l-green-500',
                    bgColor: 'bg-green-50 hover:bg-green-100',
                    icon: <Check className="w-5 h-5 text-white" />,
                    iconBg: 'bg-green-500',
                    label: 'Đúng',
                    labelColor: 'text-green-700 bg-green-100'
                };
            case 'wrong':
                return {
                    borderColor: 'border-l-red-500',
                    bgColor: 'bg-red-50 hover:bg-red-100',
                    icon: <X className="w-5 h-5 text-white" />,
                    iconBg: 'bg-red-500',
                    label: 'Sai',
                    labelColor: 'text-red-700 bg-red-100'
                };
            case 'skipped':
                return {
                    borderColor: 'border-l-gray-400',
                    bgColor: 'bg-gray-50 hover:bg-gray-100',
                    icon: <Minus className="w-5 h-5 text-white" />,
                    iconBg: 'bg-gray-400',
                    label: 'Bỏ qua',
                    labelColor: 'text-gray-600 bg-gray-100'
                };
        }
    };

    const config = getStatusConfig();

    // Get question text based on type
    const getQuestionText = () => {
        if (question.type === QuestionType.TRUE_FALSE) {
            return (question as any).mainQuestion || '';
        }
        return (question as any).question || '';
    };

    // Get question type label
    const getTypeLabel = () => {
        const typeLabels: Record<string, string> = {
            MCQ: 'Trắc nghiệm',
            TRUE_FALSE: 'Đúng/Sai',
            SHORT_ANSWER: 'Tự luận',
            MATCHING: 'Nối cặp',
            MULTIPLE_SELECT: 'Chọn nhiều',
            DRAG_DROP: 'Kéo thả',
            CATEGORIZATION: 'Phân loại',
            WORD_SCRAMBLE: 'Ghép từ',
            RIDDLE: 'Câu đố',
            UNDERLINE: 'Gạch chân',
            IMAGE_QUESTION: 'Có hình',
            DROPDOWN: 'Dropdown',
            ORDERING: 'Sắp xếp',
            ERROR_CORRECTION: 'Tìm từ sai',
        };
        return typeLabels[question.type] || question.type;
    };

    // Format student answer for display
    const formatStudentAnswer = () => {
        if (!studentAnswer) return 'Không trả lời';
        const q = question as any;

        switch (question.type) {
            case QuestionType.UNDERLINE: {
                const words: string[] = q.words || [];
                const selectedIndexes: number[] = Array.isArray(studentAnswer) ? studentAnswer : [];
                if (selectedIndexes.length === 0) return 'Không trả lời';
                return selectedIndexes.map((idx: number) => words[idx] || `[${idx}]`).join(', ');
            }
            case QuestionType.TRUE_FALSE: {
                // Show Đ/S for each item instead of "item-1: true"
                const items = q.items || [];
                return items.map((item: any, idx: number) => {
                    const key = item.id || `item-${idx}`;
                    const val = studentAnswer?.[key];
                    return val === true ? 'Đ' : val === false ? 'S' : '?';
                }).join(', ');
            }
            case QuestionType.MATCHING: {
                // Show "A → B" pairs instead of "A: B"
                const entries = Object.entries(studentAnswer).filter(([k]) => k !== 'selectedLeft');
                if (entries.length === 0) return 'Không trả lời';
                return entries.map(([k, v]) => `${k} → ${v}`).join('; ');
            }
            case QuestionType.DRAG_DROP: {
                // Show only values: "word1, word2"
                const values = Object.values(studentAnswer).filter(v => v);
                if (values.length === 0) return 'Không trả lời';
                return (values as string[]).join(', ');
            }
            case QuestionType.DROPDOWN: {
                // Show only values: "val1, val2"
                const vals = Object.values(studentAnswer).filter(v => v);
                if (vals.length === 0) return 'Không trả lời';
                return (vals as string[]).join(', ');
            }
            case QuestionType.ORDERING: {
                // Convert index array to text items
                const items = q.items || [];
                // Helper to extract text from item (string or {content} object)
                // Helper to extract text from item (string, {content} object, or char-index object)
                const getItemText = (item: any): string => {
                    if (typeof item === 'string') return item;
                    if (typeof item === 'object' && item !== null) {
                        if (item.content || item.text) return item.content || item.text;
                        // Reconstruct char-index object: {"0":"H","1":"o",...}
                        const keys = Object.keys(item);
                        if (keys.length > 0 && keys.every(k => /^\d+$/.test(k))) {
                            const maxIdx = Math.max(...keys.map(Number));
                            let result = '';
                            for (let i = 0; i <= maxIdx; i++) result += item[i] || '';
                            if (result.trim()) return result;
                        }
                    }
                    return String(item);
                };
                // Normalize studentAnswer (array or {index: position})
                let displayAnswer: any[] = [];
                if (Array.isArray(studentAnswer)) {
                    displayAnswer = studentAnswer;
                } else if (typeof studentAnswer === 'object' && studentAnswer !== null) {
                    const ordered = new Array(items.length).fill(null);
                    Object.entries(studentAnswer).forEach(([idx, pos]: [string, any]) => {
                        const p = Number(pos);
                        if (!isNaN(p) && p > 0 && p <= items.length) {
                            ordered[p - 1] = items[Number(idx)];
                        }
                    });
                    displayAnswer = ordered.filter(i => i !== null);
                }

                if (displayAnswer.length > 0) {
                    return displayAnswer.map((item: any) => {
                        if (typeof item === 'string') return item;
                        if (typeof item === 'number') {
                            const resolved = items[item];
                            return resolved ? getItemText(resolved) : `[${item}]`;
                        }
                        return getItemText(item);
                    }).join(' → ');
                }
                return 'Không trả lời';
            }
            case QuestionType.WORD_SCRAMBLE: {
                // Join letter indexes into the word
                const letters: string[] = q.letters || [];
                if (Array.isArray(studentAnswer)) {
                    return studentAnswer.map((idx: number) => letters[idx] || '?').join('');
                }
                return String(studentAnswer);
            }
            case QuestionType.ERROR_CORRECTION: {
                const ecAnswer = studentAnswer as { wrongWord?: string; correctWord?: string };
                if (ecAnswer?.wrongWord || ecAnswer?.correctWord) {
                    return `${ecAnswer.wrongWord || '?'} → ${ecAnswer.correctWord || '?'}`;
                }
                return 'Không trả lời';
            }
            case QuestionType.CATEGORIZATION: {
                // Show count: "4/6 đúng" or simplified
                const items = q.items || [];
                const placed = Object.keys(studentAnswer).filter(k => k !== '_selected').length;
                return `${placed}/${items.length} đã phân loại`;
            }
            default:
                break;
        }

        if (typeof studentAnswer === 'string') return studentAnswer;
        if (Array.isArray(studentAnswer)) return studentAnswer.join(', ');
        if (typeof studentAnswer === 'object') {
            return Object.entries(studentAnswer)
                .map(([k, v]) => `${k}: ${v}`)
                .join('; ');
        }
        return String(studentAnswer);
    };

    return (
        <div
            onClick={onClick}
            className={`
        relative border-l-2 ${config.borderColor} ${config.bgColor}
        rounded-lg p-4 cursor-pointer
        transition-all duration-200
        hover:shadow-md
        ${isExpanded ? 'ring-2 ring-indigo-500 ring-offset-2' : ''}
      `}
        >
            <div className="flex items-start gap-4">
                {/* Status icon */}
                <div className={`flex-shrink-0 w-10 h-10 rounded-full ${config.iconBg} flex items-center justify-center shadow-md`}>
                    {config.icon}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    {/* Header */}
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="text-sm font-bold text-gray-500">Câu {questionNumber}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${config.labelColor}`}>
                            {config.label}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-medium">
                            {getTypeLabel()}
                        </span>
                    </div>

                    {/* Question text */}
                    <MathSpan content={getQuestionText()} className="text-gray-800 font-medium mb-2 line-clamp-2 block" />

                    {/* Question image */}
                    {question.image && (
                        <div className="mb-2">
                            <img
                                src={question.image}
                                alt="Hình minh họa"
                                className="max-h-20 rounded border border-gray-200 object-contain"
                            />
                        </div>
                    )}

                    {/* Student answer preview */}
                    <div className="flex items-center gap-2 text-sm">
                        <HelpCircle className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-500">Em trả lời:</span>
                        <span className={`font-medium ${status === 'correct' ? 'text-green-700' : status === 'wrong' ? 'text-red-700' : 'text-gray-500'}`}>
                            {formatStudentAnswer().substring(0, 50)}
                            {formatStudentAnswer().length > 50 ? '...' : ''}
                        </span>
                    </div>
                </div>

                {/* Expand indicator */}
                <div className="flex-shrink-0">
                    <ChevronRight className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                </div>
            </div>
        </div>
    );
};

export default AnswerCard;
