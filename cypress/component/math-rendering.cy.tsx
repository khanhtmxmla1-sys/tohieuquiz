import React from 'react';
import { MathJaxContext } from 'better-react-mathjax';
import QuestionRenderer from '../../src/features/quiz-player/components/QuestionRenderer';
import InteractiveMathText from '../../src/features/quiz-player/components/QuestionRenderer/atoms/InteractiveMathText';
import ExplanationContent from '../../src/components/common/ExplanationContent';
import { QuestionType, type Question } from '../../src/types';
import { mathJaxConfig } from '../../src/config/mathJaxConfig';

type VisualQuestionName = 'mcq' | 'matching' | 'drag-drop' | 'fill-blank';

const fixtures: Record<VisualQuestionName, Question> = {
  mcq: {
    id: 'mcq-visual',
    type: QuestionType.MCQ,
    question: String.raw`Chọn phân số bằng $\frac{1}{2}$.`,
    options: [
      String.raw`$\frac{2}{4}$`,
      String.raw`$\frac{2}{3}$`,
      String.raw`$\frac{3}{5}$`,
      String.raw`$\frac{4}{5}$`,
    ],
    correctAnswer: 'A',
    mathFormatVersion: 2,
  } as Question,
  matching: {
    id: 'matching-visual',
    type: QuestionType.MATCHING,
    question: 'Nối hai biểu thức có cùng giá trị.',
    pairs: [
      { left: String.raw`$\frac{1}{2}$`, right: String.raw`$\frac{2}{4}$` },
      { left: String.raw`$\sqrt{9}$`, right: '$3$' },
    ],
    mathFormatVersion: 2,
  } as Question,
  'drag-drop': {
    id: 'drag-visual',
    type: QuestionType.DRAG_DROP,
    question: 'Kéo số thích hợp vào tử số.',
    text: String.raw`$\frac{[1]}{8}=\frac{3}{4}$`,
    blanks: ['6'],
    distractors: ['2', '4', '8'],
    mathFormatVersion: 2,
  } as Question,
  'fill-blank': {
    id: 'fill-visual',
    type: 'FILL_IN_THE_BLANK' as QuestionType,
    question: 'Điền kết quả vào ô trống.',
    text: String.raw`$\sqrt{16}+[1]=9$`,
    blanks: ['5'],
    distractors: [],
    mathFormatVersion: 2,
  } as Question,
};

const fixedAnswers = {
  'matching-visual': { __shuffledIds: ['r-0', 'r-1'] },
};

const CaseCard: React.FC<{ name: string; children: React.ReactNode }> = ({ name, children }) => (
  <section
    data-testid={`math-case-${name}`}
    className="mx-auto w-full max-w-5xl rounded-3xl border border-slate-200 bg-slate-50 p-4 shadow-sm sm:p-6"
  >
    <p className="mb-3 text-xs font-black uppercase tracking-widest text-slate-400">
      Visual regression · {name}
    </p>
    {children}
  </section>
);

const RenderQuestion: React.FC<{ name: VisualQuestionName; index: number }> = ({ name, index }) => (
  <CaseCard name={name}>
    <QuestionRenderer
      quizId="visual-regression"
      question={fixtures[name]}
      index={index}
      answers={fixedAnswers}
      onAnswerChange={() => undefined}
      onMatchingClick={() => undefined}
    />
  </CaseCard>
);

const shortAnswerExpression = String.raw`\(\frac{3}{4}+[1]=1\)`;
const explanation = [
  String.raw`**Bước 1.** Quy đồng: $\frac{1}{2}=\frac{2}{4}$.`,
  String.raw`**Bước 2.** Vì $\frac{2}{4}=\frac{1}{2}$ nên hai phân số bằng nhau.`,
].join('\n');

const Harness = () => (
  <MathJaxContext config={mathJaxConfig}>
    <style>{`
      *,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}
      html,body,#root{margin:0;min-height:100%;font-family:Arial,sans-serif;background:#e2e8f0}
      mjx-container{max-width:100%;overflow-x:auto;overflow-y:hidden}
    `}</style>
    <main className="space-y-8 bg-slate-200 p-3 sm:p-8" data-testid="math-regression-root">
      <RenderQuestion name="mcq" index={0} />
      <RenderQuestion name="matching" index={1} />
      <RenderQuestion name="drag-drop" index={2} />
      <RenderQuestion name="fill-blank" index={3} />

      <CaseCard name="short-answer">
        <div className="rounded-2xl border border-blue-100 bg-white p-5 sm:p-8">
          <div className="mb-4 inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">
            SHORT ANSWER
          </div>
          <p className="mb-4 text-lg font-bold text-slate-800">Complete the equation.</p>
          <div className="rounded-xl bg-blue-50 p-5 text-center text-xl">
            <InteractiveMathText
              content={shortAnswerExpression}
              renderBlank={(blankId, key) => (
                <input
                  key={key}
                  aria-label={`Short answer blank ${blankId}`}
                  className="mx-2 w-20 rounded-lg border-2 border-blue-300 bg-white px-2 py-1 text-center"
                  readOnly
                />
              )}
            />
          </div>
        </div>
      </CaseCard>

      <CaseCard name="explanation">
        <div className="rounded-2xl border border-emerald-100 bg-white p-5 sm:p-8">
          <h3 className="mb-3 text-lg font-black text-emerald-800">Lời giải chi tiết</h3>
          <ExplanationContent content={explanation} />
        </div>
      </CaseCard>
    </main>
  </MathJaxContext>
);

const caseNames = ['mcq', 'matching', 'drag-drop', 'fill-blank', 'short-answer', 'explanation'] as const;

const assertRendered = () => {
  cy.get('[data-testid="math-regression-root"]').should('be.visible');
  cy.get('mjx-container', { timeout: 30000 }).should('have.length.greaterThan', 0);
  cy.get('mjx-merror, .mjx-merror').should('not.exist');
  cy.contains('\\frac').should('not.exist');
  cy.wait(700);
};

const captureCases = (viewport: 'desktop' | 'mobile') => {
  for (const name of caseNames) {
    cy.get(`[data-testid="math-case-${name}"]`)
      .scrollIntoView()
      .should('be.visible')
      .screenshot(`math-${name}-${viewport}`, {
        overwrite: true,
        disableTimersAndAnimations: true,
      });
  }
};

describe('math rendering screenshot regression', () => {
  it('captures six desktop baselines', () => {
    cy.viewport(1440, 1000);
    cy.mount(<Harness />);
    assertRendered();
    captureCases('desktop');
  });

  it('captures six mobile baselines without horizontal overflow', () => {
    cy.viewport(390, 844);
    cy.mount(<Harness />);
    assertRendered();
    cy.document().then((document) => {
      expect(document.documentElement.scrollWidth).to.be.lte(document.documentElement.clientWidth + 1);
    });
    captureCases('mobile');
  });
});
