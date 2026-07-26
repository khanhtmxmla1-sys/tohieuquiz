import React from 'react';
import { BaseRendererProps } from './types';
import SmartText from './utils/SmartText';

import MCQRenderer from './renderers/MCQRenderer';
import TrueFalseRenderer from './renderers/TrueFalseRenderer';
import MultipleSelectRenderer from './renderers/MultipleSelectRenderer';
import MatchingRenderer from './renderers/MatchingRenderer';
import OrderingRenderer from './renderers/OrderingRenderer';
import ImageQuestionRenderer from './renderers/ImageQuestionRenderer';
import FillInTheBlankRenderer from './renderers/FillInTheBlankRenderer';
import ShortAnswerRenderer from './renderers/ShortAnswerRenderer';
import MathRenderer from './renderers/MathRenderer';
import GeometryRenderer from './renderers/GeometryRenderer';
import DragDropRenderer from './renderers/DragDropRenderer';
import UnderlineRenderer from './renderers/UnderlineRenderer';

const QuestionRenderer: React.FC<BaseRendererProps> = (props) => {
  const { question: question, index, quizId } = props;
  const rawType = (question.type || 'MCQ').toString().toUpperCase();
  const normalizedType = rawType.replace(/-/g, '_');

  const renderers: Record<string, React.FC<BaseRendererProps>> = {
    MCQ: MCQRenderer,
    MULTIPLE_CHOICE: MCQRenderer,
    TRUE_FALSE: TrueFalseRenderer,
    MULTIPLE_SELECT: MultipleSelectRenderer,
    MATCHING: MatchingRenderer,
    ORDERING: OrderingRenderer,
    IMAGE: ImageQuestionRenderer,
    IMAGE_QUESTION: ImageQuestionRenderer,
    FILL_IN_THE_BLANK: FillInTheBlankRenderer,
    DROPDOWN: FillInTheBlankRenderer,
    DRAG_DROP: FillInTheBlankRenderer,
    CATEGORIZATION: DragDropRenderer,
    SHORT_ANSWER: ShortAnswerRenderer,
    MATH_INPUT: MathRenderer,
    GEOMETRY: GeometryRenderer,
    UNDERLINE: UnderlineRenderer,
  };

  const SelectedRenderer = renderers[normalizedType]
    || ((question as any).mathType ? MathRenderer : MCQRenderer);

  return (
    <section
      className="question-renderer-shell overflow-hidden rounded-[14px] border border-[#E5E7EB] bg-white"
      data-math-quiz-id={quizId || ''}
      data-math-question-id={question.id}
      data-math-question-type={normalizedType}
      data-math-format-version={(question as any).mathFormatVersion || (question as any).math_format_version || 1}
    >
      <div className="flex items-start gap-4 border-b border-slate-100 px-5 py-5 sm:px-6 md:py-6">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] border border-slate-200 bg-white text-sm font-semibold text-slate-600">
          {index + 1}
        </span>
        <div className="min-h-9 flex-1 py-1 text-base font-medium leading-7 text-[#172033] sm:text-lg">
          <SmartText
            content={(question as any).mainQuestion || (question as any).content || (question as any).question}
            className="leading-relaxed"
          />
        </div>
      </div>

      <div className="space-y-6 p-5 sm:p-6 md:p-7">
        {question.image && normalizedType !== 'IMAGE' && normalizedType !== 'IMAGE_QUESTION' ? (
          <div className="mb-6 flex justify-center">
            <img
              src={question.image}
              alt={`Câu ${index + 1}`}
              className="max-h-72 rounded-[10px] border border-slate-200 object-contain"
            />
          </div>
        ) : null}

        <SelectedRenderer {...props} />
      </div>
    </section>
  );
};

export default React.memo(QuestionRenderer);
export * from './types';
