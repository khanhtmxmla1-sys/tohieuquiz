import React, { useMemo, useState } from 'react';
import type {
    QuestionAnswerReview,
    ReviewBlankItem,
    ReviewCategorizationItem,
    ReviewChoiceItem,
    ReviewErrorCorrectionItem,
    ReviewMatchingItem,
    ReviewOrderingItem,
    ReviewTextAnswerItem,
    ReviewTrueFalseItem,
    ReviewUnderlineItem,
    ReviewWordScrambleItem,
} from '../../../domain/quiz-scoring';
import MathSpan from '../MathSpan';
import SafeRasterImage from '../SafeRasterImage';
import {
    answerText,
    asQuestionRecord,
    choicePresentationOf,
    choiceStateLabel,
    displayValue,
    matchingPresentationOf,
    blankPresentationOf,
    orderingPresentationOf,
    categorizationPresentationOf,
    underlinePresentationOf,
    textAnswerPresentationOf,
    wordScramblePresentationOf,
    errorCorrectionPresentationOf,
    fallbackReviewValue,
    isLegacyOrUnsupported,
    isTrustedPresentation,
    reviewPresentationOf,
    trueFalsePresentationOf,
    type StudentReviewOutcome,
} from './reviewPresentationModel';

interface StudentReviewBodyProps {
    question: unknown;
    selectedAnswer: unknown;
    reviewDetail?: QuestionAnswerReview;
    outcome: StudentReviewOutcome;
    showExplanation?: boolean;
}

const ReviewValue: React.FC<{ title: string; value: ReturnType<typeof fallbackReviewValue> }> = ({ title, value }) => (
    <div className="rounded-[9px] bg-slate-50 p-3">
        <div className="font-semibold text-slate-500">{title}</div>
        <div className="mt-1 space-y-1.5 font-medium text-slate-800">
            {value.lines.map((line, index) => (
                <div key={`${line.label || 'value'}-${index}`} className="break-words">
                    {line.label ? <span className="font-semibold">{line.label}: </span> : null}
                    <MathSpan content={line.value} />
                </div>
            ))}
        </div>
    </div>
);

const ChoiceState: React.FC<{ item: ReviewChoiceItem }> = ({ item }) => {
    if (item.state === 'unknown') return null;
    return (
        <span className="mt-1 inline-flex max-w-full rounded-[6px] border border-current px-2 py-1 text-xs font-bold">
            {choiceStateLabel(item)}
        </span>
    );
};

const choiceClassName = (item: ReviewChoiceItem): string => {
    const base = 'rounded-[10px] border p-3 transition-colors';
    if (item.state === 'correct') return `${base} border-emerald-300 bg-emerald-50 text-emerald-900`;
    if (item.state === 'incorrect') return `${base} border-rose-300 bg-rose-50 text-rose-900`;
    if (item.state === 'skipped' && item.correct) return `${base} border-emerald-400 bg-white text-emerald-900`;
    return `${base} border-slate-200 bg-white text-slate-800`;
};

const ChoiceReview: React.FC<{ question: unknown; presentation: Exclude<ReturnType<typeof choicePresentationOf>, undefined> }> = ({ question, presentation }) => {
    const record = asQuestionRecord(question);
    const optionImages = Array.isArray(record.optionImages) ? record.optionImages : [];
    const items = useMemo(() => [...presentation.items].sort((left, right) => left.index - right.index), [presentation.items]);

    return (
        <div className="space-y-2" aria-label="Các phương án trả lời">
            {items.map((item, index) => {
                const label = String.fromCharCode(65 + (Number.isInteger(item.index) ? item.index : index));
                const image = typeof optionImages[item.index] === 'string' ? String(optionImages[item.index]).trim() : '';
                return (
                    <div
                        key={`${item.id}-${item.index}`}
                        data-testid="student-review-option"
                        data-option-id={item.id}
                        data-state={item.state}
                        className={choiceClassName(item)}
                    >
                        <div className="flex min-w-0 items-start gap-3">
                            <span className="shrink-0 font-bold" aria-label={`Phương án ${label}`}>{label}. </span>
                            <div className="min-w-0 flex-1">
                                <MathSpan content={item.text} className="break-words font-medium" />
                                {image ? (
                                    <SafeRasterImage
                                        src={image}
                                        alt={`Đáp án ${label}: ${item.text}`}
                                        loading="lazy"
                                        decoding="async"
                                        className="mt-2 h-32 w-full rounded-[8px] border border-slate-200 bg-slate-50 object-contain sm:h-36"
                                    />
                                ) : null}
                                <ChoiceState item={item} />
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

const trueFalseClassName = (item: ReviewTrueFalseItem): string => {
    const base = 'rounded-[10px] border p-3';
    if (item.state === 'correct') return `${base} border-emerald-300 bg-emerald-50`;
    if (item.state === 'incorrect') return `${base} border-rose-300 bg-rose-50`;
    if (item.state === 'skipped') return `${base} border-slate-300 bg-slate-50`;
    return `${base} border-slate-200 bg-white`;
};

const TrueFalseReview: React.FC<{ presentation: Exclude<ReturnType<typeof trueFalsePresentationOf>, undefined> }> = ({ presentation }) => {
    const items = useMemo(() => [...presentation.items].sort((left, right) => left.index - right.index), [presentation.items]);

    return (
        <div className="space-y-2" aria-label="Các mệnh đề đúng sai">
            {items.map((item, index) => (
                <div
                    key={`${item.id}-${item.index}`}
                    data-testid="student-review-true-false-row"
                    data-state={item.state}
                    className={trueFalseClassName(item)}
                >
                    <div className="flex min-w-0 items-start gap-3">
                        <span className="shrink-0 font-bold text-slate-500">{index + 1}.</span>
                        <div className="min-w-0 flex-1">
                            <MathSpan content={item.statement} className="font-medium text-slate-900" />
                            <div className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                                <span className="font-semibold text-slate-700">Em chọn: {answerText(item.studentValue)}</span>
                                <span className="font-semibold text-emerald-800">Đáp án đúng: {answerText(item.correctValue)}</span>
                            </div>
                            <span className="mt-1 inline-flex rounded-[6px] border border-current px-2 py-1 text-xs font-bold text-slate-600">
                                {item.state === 'correct'
                                    ? 'Đúng ý này'
                                    : item.state === 'incorrect'
                                        ? 'Sai ý này'
                                        : item.state === 'skipped'
                                            ? 'Chưa trả lời ý này'
                                            : 'Chưa có dữ liệu đối chiếu'}
                            </span>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

type ReviewItem = { state: ReviewChoiceItem['state'] };

const stateLabel = (state: ReviewItem['state']): string => {
    if (state === 'correct') return 'Đúng';
    if (state === 'incorrect') return 'Sai';
    if (state === 'skipped') return 'Chưa trả lời';
    return 'Chưa có dữ liệu đối chiếu';
};

const stateClassName = (state: ReviewItem['state']): string => {
    if (state === 'correct') return 'border-emerald-300 bg-emerald-50 text-emerald-900';
    if (state === 'incorrect') return 'border-rose-300 bg-rose-50 text-rose-900';
    if (state === 'skipped') return 'border-slate-300 bg-slate-50 text-slate-800';
    return 'border-slate-200 bg-white text-slate-700';
};

const StateLabel: React.FC<{ state: ReviewItem['state'] }> = ({ state }) => (
    <span className="mt-1 inline-flex max-w-full rounded-[6px] border border-current px-2 py-1 text-xs font-bold">
        {stateLabel(state)}
    </span>
);

const valueText = (value: unknown, emptyLabel = 'Chưa trả lời'): string => {
    if (value === undefined || value === null || value === '') return emptyLabel;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
    return displayValue(value);
};

const visibleText = (value: unknown): string => {
    if (value === undefined || value === null) return '';
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (Array.isArray(value)) return value.map(visibleText).filter(Boolean).join(' ');
    if (typeof value === 'object') {
        const record = value as Record<string, unknown>;
        for (const key of ['text', 'content', 'line', 'value', 'label', 'hint']) {
            const text = visibleText(record[key]);
            if (text) return text;
        }
    }
    return '';
};

const questionVisibleText = (question: unknown): string => {
    const record = asQuestionRecord(question);
    return visibleText(record.question ?? record.mainQuestion ?? record.questionText ?? record.text ?? record.sentence);
};

const ContextText: React.FC<{ label: string; value: unknown }> = ({ label, value }) => {
    const text = visibleText(value);
    if (!text) return null;
    return (
        <div className="rounded-[9px] bg-slate-50 p-3 text-sm text-slate-800">
            <div className="font-semibold text-slate-500">{label}</div>
            <MathSpan content={text} className="mt-1 block break-words" />
        </div>
    );
};

const InlineBlankPrompt: React.FC<{
    question: unknown;
    items: readonly ReviewBlankItem[];
}> = ({ question, items }) => {
    const record = asQuestionRecord(question);
    const promptCandidates = [record.text, record.sentence, record.question, record.mainQuestion, record.questionText]
        .map(visibleText)
        .filter(Boolean);
    const prompt = promptCandidates.find((candidate) => /\[[^\]]+\]|\{\{[^}]+\}\}|_{3,}/.test(candidate))
        ?? promptCandidates[0]
        ?? questionVisibleText(question);
    if (!prompt) return null;
    const itemByToken = new Map<string, ReviewBlankItem>();
    items.forEach((item) => {
        for (const token of [item.blankToken, item.id, `[${item.id}]`, `{{${item.id}}}`]) {
            if (token) itemByToken.set(token, item);
        }
    });
    const chunks = prompt.split(/(\[[^\]]+\]|\{\{[^}]+\}\}|_{3,})/g);
    return (
        <div className="rounded-[9px] border border-sky-100 bg-sky-50 p-3 text-sm leading-7" aria-label="Nội dung câu hỏi">
            {chunks.map((chunk, index) => {
                const item = itemByToken.get(chunk);
                if (!item) return <MathSpan key={`${chunk}-${index}`} content={chunk} />;
                return (
                    <span
                        key={`${item.id}-${item.index}`}
                        data-testid="student-review-inline-blank"
                        data-blank-id={item.id}
                        data-state={item.state}
                        className="mx-1 inline-flex max-w-full items-center gap-1 rounded-[6px] border border-sky-300 bg-white px-2 py-0.5 align-middle font-semibold text-sky-950"
                    >
                        <span className="sr-only">Ô {item.blankToken}: </span>
                        <MathSpan content={valueText(item.studentValue)} />
                        <span className="text-xs">({stateLabel(item.state)})</span>
                    </span>
                );
            })}
        </div>
    );
};

const MatchingReview: React.FC<{ presentation: Exclude<ReturnType<typeof matchingPresentationOf>, undefined> }> = ({ presentation }) => {
    const items = useMemo(() => [...presentation.items].sort((left, right) => left.index - right.index), [presentation.items]);
    return (
        <div className="space-y-2" aria-label="Các cặp ghép nối">
            {items.map((item: ReviewMatchingItem) => (
                <div
                    key={`${item.id}-${item.index}`}
                    data-testid="student-review-matching-row"
                    data-state={item.state}
                    className={`rounded-[10px] border p-3 ${stateClassName(item.state)}`}
                >
                    <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center">
                        <div className="min-w-0 break-words"><MathSpan content={item.leftText} /></div>
                        <span className="hidden font-bold sm:block" aria-hidden="true">→</span>
                        <div className="min-w-0 space-y-1 break-words text-sm">
                            <div><span className="font-semibold">Em nối: </span><MathSpan content={valueText(item.studentRightText, 'Chưa nối')} /></div>
                            <div><span className="font-semibold">Đáp án đúng: </span><MathSpan content={item.correctRightText} /></div>
                            <StateLabel state={item.state} />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

const BlankReview: React.FC<{
    question: unknown;
    presentation: Exclude<ReturnType<typeof blankPresentationOf>, undefined>;
}> = ({ question, presentation }) => {
    const items = useMemo(() => [...presentation.items].sort((left, right) => left.index - right.index), [presentation.items]);
    return (
        <div className="space-y-2" aria-label="Các ô trống">
            <InlineBlankPrompt question={question} items={items} />
            {items.map((item: ReviewBlankItem) => (
                <div
                    key={`${item.id}-${item.index}`}
                    data-testid="student-review-blank-row"
                    data-blank-id={item.id}
                    data-state={item.state}
                    className={`rounded-[10px] border p-3 ${stateClassName(item.state)}`}
                >
                    <div className="min-w-0 space-y-1 break-words text-sm">
                        <div className="font-semibold">Chỗ trống {item.index + 1}</div>
                        <div><span className="font-semibold">Em làm: </span><MathSpan content={valueText(item.studentValue)} /></div>
                        <div><span className="font-semibold">Đáp án đúng: </span><MathSpan content={item.correctValue} /></div>
                        <StateLabel state={item.state} />
                    </div>
                </div>
            ))}
        </div>
    );
};

const OrderingReview: React.FC<{ presentation: Exclude<ReturnType<typeof orderingPresentationOf>, undefined> }> = ({ presentation }) => {
    const items = useMemo(() => [...presentation.items].sort((left, right) => left.index - right.index), [presentation.items]);
    return (
        <div className="space-y-2" aria-label="Thứ tự các mục">
            {items.map((item: ReviewOrderingItem) => (
                <div
                    key={`${item.id}-${item.index}`}
                    data-testid="student-review-ordering-row"
                    data-state={item.state}
                    className={`rounded-[10px] border p-3 ${stateClassName(item.state)}`}
                >
                    <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                        <MathSpan content={item.text} className="min-w-0 flex-1 break-words font-medium" />
                        <div className="shrink-0 text-right text-sm">
                            <div><span className="font-semibold">Em xếp: </span>{item.studentRank ?? 'Chưa xếp'}</div>
                            <div><span className="font-semibold">Đáp án đúng: </span>{item.correctRank}</div>
                            <StateLabel state={item.state} />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

const CategorizationReview: React.FC<{ presentation: Exclude<ReturnType<typeof categorizationPresentationOf>, undefined> }> = ({ presentation }) => {
    const items = useMemo(() => [...presentation.items].sort((left, right) => left.index - right.index), [presentation.items]);
    return (
        <div className="space-y-2" aria-label="Các mục phân loại">
            {items.map((item: ReviewCategorizationItem) => (
                <div
                    key={`${item.id}-${item.index}`}
                    data-testid="student-review-categorization-row"
                    data-state={item.state}
                    className={`rounded-[10px] border p-3 ${stateClassName(item.state)}`}
                >
                    <div className="min-w-0 space-y-1 break-words text-sm">
                        <MathSpan content={item.text} className="font-medium" />
                        <div><span className="font-semibold">Em xếp: </span><MathSpan content={valueText(item.studentCategoryText, 'Chưa xếp')} /></div>
                        <div><span className="font-semibold">Đáp án đúng: </span><MathSpan content={item.correctCategoryText} /></div>
                        <StateLabel state={item.state} />
                    </div>
                </div>
            ))}
        </div>
    );
};

const UnderlineReview: React.FC<{ presentation: Exclude<ReturnType<typeof underlinePresentationOf>, undefined> }> = ({ presentation }) => {
    const items = useMemo(() => [...presentation.items].sort((left, right) => left.index - right.index), [presentation.items]);
    return (
        <div className="flex flex-wrap gap-2" aria-label="Các từ cần gạch chân">
            {items.map((item: ReviewUnderlineItem) => (
                <div
                    key={`${item.id}-${item.index}`}
                    data-testid="student-review-underline-word"
                    data-word-index={item.index}
                    data-state={item.state}
                    className={`rounded-[8px] border px-3 py-2 text-sm ${stateClassName(item.state)}`}
                >
                    <MathSpan content={item.text} className={item.selected ? 'font-bold underline decoration-2 underline-offset-2' : 'font-medium'} />
                    <div className="mt-1 text-xs font-bold">
                        {item.selected ? `Em chọn · ${stateLabel(item.state)}` : item.correct ? 'Đáp án đúng · Em chưa chọn' : 'Không chọn'}
                    </div>
                </div>
            ))}
        </div>
    );
};

const TextAnswerReview: React.FC<{
    question: unknown;
    presentation: Exclude<ReturnType<typeof textAnswerPresentationOf>, undefined>;
}> = ({ question, presentation }) => {
    const record = asQuestionRecord(question);
    const isRiddle = presentation.type === 'RIDDLE';
    const context = isRiddle
        ? [record.riddleLines, record.riddle, record.hint ?? record.riddleHint]
            .map(visibleText)
            .filter(Boolean)
            .join('\n')
        : undefined;
    return (
    <div className="space-y-2" aria-label="Câu trả lời dạng văn bản">
        <ContextText label="Gợi ý câu đố" value={context} />
        {presentation.items.map((item: ReviewTextAnswerItem) => (
            <div
                key={`${item.id}-${item.index}`}
                data-testid="student-review-text-answer"
                data-state={item.state}
                className={`rounded-[10px] border p-3 text-sm ${stateClassName(item.state)}`}
            >
                <div><span className="font-semibold">Bài làm: </span><MathSpan content={valueText(item.studentValue)} /></div>
                <div><span className="font-semibold">Đáp án đúng: </span><MathSpan content={item.correctValues.length > 0 ? item.correctValues.join(' / ') : 'Chưa có đáp án'} /></div>
                <StateLabel state={item.state} />
            </div>
        ))}
    </div>
    );
};

const WordScrambleReview: React.FC<{ presentation: Exclude<ReturnType<typeof wordScramblePresentationOf>, undefined> }> = ({ presentation }) => (
    <div className="space-y-2" aria-label="Các chữ cái ghép từ">
        {presentation.items.map((item: ReviewWordScrambleItem) => (
            <div
                key={`${item.id}-${item.index}`}
                data-testid="student-review-word-scramble"
                data-state={item.state}
                className={`rounded-[10px] border p-3 text-sm ${stateClassName(item.state)}`}
            >
                <div><span className="font-semibold">Em ghép: </span><MathSpan content={valueText(item.studentValue)} /></div>
                <div><span className="font-semibold">Đáp án đúng: </span><MathSpan content={item.correctValue} /></div>
                <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Thứ tự chữ cái em đã chọn">
                    {item.studentLetterIndexes && item.studentLetterIndexes.length > 0 ? item.studentLetterIndexes.map((sourceIndex, sequenceIndex) => {
                        const letter = item.letters[sourceIndex] ?? '';
                        return (
                            <span
                                key={`${sequenceIndex}-${sourceIndex}-${letter}`}
                                data-testid="student-review-letter"
                                data-letter-index={sourceIndex}
                                className="rounded border border-current px-2 py-1 font-mono font-bold"
                            >
                                <MathSpan content={letter} />
                            </span>
                        );
                    }) : (
                        <span className="text-sm font-semibold text-slate-600">Chưa chọn chữ cái</span>
                    )}
                </div>
                <StateLabel state={item.state} />
            </div>
        ))}
    </div>
);

const ErrorCorrectionReview: React.FC<{
    question: unknown;
    presentation: Exclude<ReturnType<typeof errorCorrectionPresentationOf>, undefined>;
}> = ({ question, presentation }) => {
    const record = asQuestionRecord(question);
    const context = [record.passage, record.sentence, record.text]
        .map(visibleText)
        .find(Boolean);
    return (
    <div className="space-y-2" aria-label="Sửa lỗi trong câu">
        <ContextText label="Ngữ cảnh" value={context} />
        {presentation.items.map((item: ReviewErrorCorrectionItem) => (
            <div
                key={`${item.id}-${item.index}`}
                data-testid="student-review-error-correction"
                data-state={item.state}
                className={`rounded-[10px] border p-3 text-sm ${stateClassName(item.state)}`}
            >
                <div><span className="font-semibold">Từ sai: </span><MathSpan content={item.correctWrongWord} /></div>
                <div><span className="font-semibold">Em chọn từ sai: </span><MathSpan content={valueText(item.studentWrongWord, 'Chưa chọn')} /></div>
                <div><span className="font-semibold">Em sửa: </span><MathSpan content={valueText(item.studentCorrectWord)} /></div>
                <div><span className="font-semibold">Đáp án đúng: </span><MathSpan content={item.correctWord} /></div>
                <StateLabel state={item.state} />
            </div>
        ))}
    </div>
    );
};

const StudentReviewBody: React.FC<StudentReviewBodyProps> = ({
    question,
    selectedAnswer,
    reviewDetail,
    outcome,
    showExplanation = true,
}) => {
    const [explanationOpen, setExplanationOpen] = useState(false);
    const presentation = reviewPresentationOf(reviewDetail);
    const choicePresentation = choicePresentationOf(presentation);
    const trueFalsePresentation = trueFalsePresentationOf(presentation);
    const matchingPresentation = matchingPresentationOf(presentation);
    const blankPresentation = blankPresentationOf(presentation);
    const orderingPresentation = orderingPresentationOf(presentation);
    const categorizationPresentation = categorizationPresentationOf(presentation);
    const underlinePresentation = underlinePresentationOf(presentation);
    const textAnswerPresentation = textAnswerPresentationOf(presentation);
    const wordScramblePresentation = wordScramblePresentationOf(presentation);
    const errorCorrectionPresentation = errorCorrectionPresentationOf(presentation);
    const showLegacyNotice = isLegacyOrUnsupported(presentation);
    const studentValue = fallbackReviewValue(reviewDetail?.studentAnswer, selectedAnswer);
    const correctValue = reviewDetail?.correctAnswer;
    const showCorrectValue = outcome !== 'correct'
        && outcome !== 'voided'
        && !showLegacyNotice
        && correctValue?.kind !== 'unsupported'
        && Boolean(correctValue && correctValue.lines.length > 0);
    const hasStructuredBody = Boolean(
        (choicePresentation && choicePresentation.items.length > 0)
        || (trueFalsePresentation && trueFalsePresentation.items.length > 0)
        || (matchingPresentation && matchingPresentation.items.length > 0)
        || (blankPresentation && blankPresentation.items.length > 0)
        || (orderingPresentation && orderingPresentation.items.length > 0)
        || (categorizationPresentation && categorizationPresentation.items.length > 0)
        || (underlinePresentation && underlinePresentation.items.length > 0)
        || (textAnswerPresentation && textAnswerPresentation.items.length > 0)
        || (wordScramblePresentation && wordScramblePresentation.items.length > 0)
        || (errorCorrectionPresentation && errorCorrectionPresentation.items.length > 0),
    );
    const explanation = String(asQuestionRecord(question).explanation ?? '').trim();

    return (
        <div className="mt-4 space-y-3" data-testid="student-review-body">
            {showLegacyNotice ? (
                <p role="status" className="rounded-[9px] border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
                    Dữ liệu lịch sử chưa đủ để đối chiếu từng đáp án.
                </p>
            ) : null}

            {hasStructuredBody ? (
                choicePresentation ? (
                    <ChoiceReview question={question} presentation={choicePresentation} />
                ) : trueFalsePresentation ? (
                    <TrueFalseReview presentation={trueFalsePresentation} />
                ) : matchingPresentation ? (
                    <MatchingReview presentation={matchingPresentation} />
                ) : blankPresentation ? (
                    <BlankReview question={question} presentation={blankPresentation} />
                ) : orderingPresentation ? (
                    <OrderingReview presentation={orderingPresentation} />
                ) : categorizationPresentation ? (
                    <CategorizationReview presentation={categorizationPresentation} />
                ) : underlinePresentation ? (
                    <UnderlineReview presentation={underlinePresentation} />
                ) : textAnswerPresentation ? (
                    <TextAnswerReview question={question} presentation={textAnswerPresentation} />
                ) : wordScramblePresentation ? (
                    <WordScrambleReview presentation={wordScramblePresentation} />
                ) : errorCorrectionPresentation ? (
                    <ErrorCorrectionReview question={question} presentation={errorCorrectionPresentation} />
                ) : (
                    <ReviewValue title="Câu trả lời của em" value={studentValue} />
                )
            ) : (
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                    <ReviewValue title="Câu trả lời của em" value={studentValue} />
                    {showCorrectValue ? <ReviewValue title="Đáp án đúng" value={correctValue!} /> : null}
                </div>
            )}

            {showExplanation && explanation && isTrustedPresentation(presentation) ? (
                <div className="rounded-[9px] border border-emerald-200 bg-emerald-50 p-3">
                    <button
                        type="button"
                        aria-expanded={explanationOpen}
                        aria-controls={`student-review-explanation-${String(asQuestionRecord(question).id ?? 'question')}`}
                        onClick={() => setExplanationOpen((open) => !open)}
                        className="rounded-[6px] font-bold text-emerald-800 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                    >
                        {explanationOpen ? 'Ẩn lời giải' : 'Xem lời giải'}
                    </button>
                    <div
                        id={`student-review-explanation-${String(asQuestionRecord(question).id ?? 'question')}`}
                        hidden={!explanationOpen}
                        className="mt-2 border-t border-emerald-200 pt-2 text-sm leading-relaxed text-emerald-950"
                    >
                        <MathSpan content={explanation} />
                    </div>
                </div>
            ) : null}
        </div>
    );
};

export type { StudentReviewBodyProps };
export default StudentReviewBody;
