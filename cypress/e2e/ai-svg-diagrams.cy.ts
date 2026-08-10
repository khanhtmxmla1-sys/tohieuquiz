/// <reference types="cypress" />

import { auditGeneratedQuizV3 } from '../../src/services/ai/quizAudit';
import type { QuizBlueprintV3 } from '../../src/features/quiz-generator/domain/quizBlueprint';
import type { GeneratedQuizV3 } from '../../src/services/ai/question-contracts/questionContract.types';

const TEACHER = 'ai-svg-e2e-teacher';
const SVG_ALT = 'Tam giác ABC có đáy AB nằm ngang và đỉnh C ở phía trên';
const SVG_CONTENT = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 260"><polygon points="80,210 320,210 190,45" fill="none" stroke="#1e3a8a" stroke-width="4"/><text x="65" y="230" font-size="20">A</text><text x="325" y="230" font-size="20">B</text><text x="185" y="35" font-size="20">C</text></svg>';

interface Slot {
  slotId: string;
  type: string;
  difficulty: 1 | 2 | 3;
  diagramPolicy: 'forbidden' | 'optional' | 'required';
}

const authStorageValue = JSON.stringify({
  state: {
    isLoggedIn: true,
    username: TEACHER,
    teacherName: 'Cô SVG E2E',
    isAdmin: false,
    teacherClass: '4A',
  },
  version: 0,
});

const installTeacherSession = (win: Window) => {
  win.localStorage.setItem('auth-storage', authStorageValue);
  win.localStorage.setItem(
    'tohieuquiz_teacher_dashboard_ui',
    JSON.stringify({ state: { activeTab: 'create' }, version: 2 }),
  );
  win.localStorage.setItem(
    'tohieuquiz-store',
    JSON.stringify({ state: { view: 'teacher_dash', quizzes: [] }, version: 0 }),
  );
};

const parseSlots = (prompt: string): Slot[] => {
  const match = prompt.match(/\[EXACT SLOT TABLE\]\s*([\s\S]*?)\s*\[SELECTED TYPE CONTRACTS\]/);
  expect(match, 'slot table in V3 prompt').not.to.equal(null);
  return JSON.parse(match?.[1].trim() || '[]') as Slot[];
};

const buildQuestion = (
  slot: Slot,
  index: number,
  contractFixtures: Array<Record<string, unknown>>,
) => {
  const source = contractFixtures.find((question) => question.type === slot.type);
  expect(source, `fixture contract for ${slot.type}`).not.to.equal(undefined);
  const question = JSON.parse(JSON.stringify(source || {})) as Record<string, unknown>;
  question.slotId = slot.slotId;
  question.type = slot.type;
  question.difficulty = slot.difficulty;
  question.diagramPolicy = slot.diagramPolicy;

  const uniqueContexts = [
    'v??n c?y',
    'd?ng s?ng',
    's?n tr??ng',
    'th? vi?n',
    'c?nh ??ng',
    'b?u tr?i',
    'khu ph?',
    'l?p h?c',
    'c?ng vi?n',
    'b? bi?n',
  ];
  const suffix = ` trong ch? ?? ${uniqueContexts[index] || `n?i dung ${index + 1}`}`;
  if (typeof question.question === 'string') question.question += suffix;
  if (typeof question.mainQuestion === 'string') question.mainQuestion += suffix;
  if (typeof question.sentence === 'string') question.sentence += suffix;
  delete question.explanation;

  if (index === 0) {
    question.svgContent = SVG_CONTENT;
    question.svgAlt = SVG_ALT;
    question.svgVersion = 1;
  } else {
    delete question.svgContent;
    delete question.svgAlt;
    delete question.svgVersion;
  }
  return question;
};

const installTeacherApi = (contractFixtures: Array<Record<string, unknown>>) => {
  const observedStages: string[] = [];
  let observedAuditIssues: unknown[] = [];
  cy.intercept('GET', '**/api/account/me', {
    statusCode: 200,
    body: {
      data: {
        username: TEACHER,
        fullName: 'Cô SVG E2E',
        role: 'teacher',
        classes: [{ id: 'class-4a', name: '4A' }],
        mustChangePassword: false,
      },
    },
  });
  cy.intercept('GET', '**/api/teacher-ai-quota', {
    statusCode: 200,
    body: {
      status: 'success',
      data: {
        username: TEACHER,
        role: 'teacher',
        usageDate: '2026-08-04',
        dailyLimit: 5,
        usedCount: 0,
        remaining: 5,
        canGenerate: true,
        unlimited: false,
      },
    },
  });
  cy.intercept('GET', '**/api/classes*', { statusCode: 200, body: { status: 'success', data: [] } });
  cy.intercept('GET', '**/api/quizzes*', { statusCode: 200, body: { status: 'success', data: [] } });
  cy.intercept('GET', '**/api/results*', { statusCode: 200, body: { status: 'success', data: [] } });

  let generatedQuiz: Record<string, unknown> | null = null;
  cy.intercept('POST', '**/api/ai/chat', (request) => {
    const stage = String(request.body?._meta?.stage || 'UNKNOWN');
    observedStages.push(stage);
    const rawContent = request.body?.messages?.[1]?.content;
    const prompt = Array.isArray(rawContent)
      ? rawContent.map((part) => String(part?.text || '')).join('\n')
      : typeof rawContent === 'string'
        ? rawContent
        : String(rawContent?.text || '');
    if (request.body?._meta?.stage === 'GENERATE') {
      expect(prompt).to.contain('[SVG DIAGRAM POLICY: AUTO]');
      const slots = parseSlots(prompt);
      expect(slots.some((slot) => slot.diagramPolicy === 'optional')).to.equal(true);
      generatedQuiz = {
        promptVersion: 'ai-blueprint-v3',
        blueprintVersion: 3,
        title: 'Đề AI có hình SVG',
        detectedCategory: 'toan',
        detectedLesson: 'Hình học',
        suggestedTags: ['svg', 'hinh_hoc'],
        timeLimit: 20,
        questions: slots.map((slot, index) => buildQuestion(slot, index, contractFixtures)),
      };
      observedAuditIssues = auditGeneratedQuizV3(
        generatedQuiz as unknown as GeneratedQuizV3,
        {
          version: 3,
          intent: 'PRACTICE',
          sourceMode: 'TOPIC',
          topic: 'Hình học lớp 4',
          classLevel: '3',
          totalQuestions: slots.length,
          slots,
        } as unknown as QuizBlueprintV3,
      );
    }
    request.reply({
      statusCode: 200,
      body: { choices: [{ message: { content: JSON.stringify(generatedQuiz) } }] },
    });
  }).as('aiSvg');

  cy.intercept('POST', '**/api/quizzes', (request) => {
    const question = request.body.questions.find((item: Record<string, unknown>) => item.svgContent);
    expect(question.svgContent).to.contain('<svg');
    expect(question.svgAlt).to.equal(SVG_ALT);
    expect(question.svgVersion).to.equal(1);
    request.reply({ statusCode: 200, body: { status: 'success', questionCount: request.body.questions.length } });
  }).as('saveQuiz');

  return {
    observedStages,
    getObservedAuditIssues: () => observedAuditIssues,
  };
};

const studentQuiz = {
  id: 'svg-student-quiz',
  title: 'Bài làm có hình SVG',
  classLevel: '4',
  category: 'toan',
  timeLimit: 10,
  requireCode: false,
  isPractice: true,
  questions: [{
    id: 'svg-mcq',
    quizId: 'svg-student-quiz',
    type: 'MCQ',
    question: 'Quan sát tam giác ABC. Cạnh nào nằm ngang?',
    options: ['AB', 'BC', 'CA', 'Không có cạnh nào'],
    correctAnswer: 'A',
    svgContent: SVG_CONTENT,
    svgAlt: SVG_ALT,
    svgVersion: 1,
  }],
};

const installStudentQuiz = (win: Window) => {
  win.localStorage.setItem('tohieuquiz-store', JSON.stringify({
    state: {
      view: 'student',
      quizzes: [studentQuiz],
      selectedQuiz: studentQuiz,
      quizzesLoadedAt: Date.now(),
    },
    version: 0,
  }));
};

describe('AI SVG diagrams end-to-end', () => {
  it('enables the teacher option, previews a safe image and persists SVG fields', () => {
    cy.fixture('ai-blueprint-v3-13-types.json').then((fixture) => {
      const aiTrace = installTeacherApi(fixture.questions as Array<Record<string, unknown>>);
      cy.visit('/teacher/quizzes?mode=create', { onBeforeLoad: installTeacherSession });
      cy.contains('Tạo đề bằng AI', { timeout: 15_000 }).should('be.visible');

      cy.get('input[aria-label="Tự động thêm hình vẽ minh họa"]')
        .should('not.be.checked');
      cy.get('label[for="auto-generate-svg-diagrams"]').click();
      cy.get('input[aria-label="Tự động thêm hình vẽ minh họa"]')
        .should('be.checked');
      cy.get('input[placeholder*="Động vật rừng xanh"]').clear().type('Hình học lớp 4');
      cy.contains('button', '📚 Ra đề ÔN TẬP').click();
      cy.wait('@aiSvg').then(({ request, response }) => {
        expect(request.body?._meta?.stage).to.equal('GENERATE');
        const rawContent = response?.body?.choices?.[0]?.message?.content;
        const returnedQuiz = JSON.parse(String(rawContent || '{}')) as {
          questions?: Array<Record<string, unknown>>;
        };
        expect(returnedQuiz.questions?.[0]?.diagramPolicy).to.equal('optional');
        expect(returnedQuiz.questions?.[0]?.svgContent).to.equal(SVG_CONTENT);
      });

      cy.contains('Đề AI có hình SVG', { timeout: 20_000 }).should('be.visible');
      cy.then(() => {
        expect(aiTrace.getObservedAuditIssues()).to.deep.equal([]);
        expect(aiTrace.observedStages).to.include('GENERATE');
      });
      cy.get(`img[alt="${SVG_ALT}"]`, { timeout: 20_000 }).should(($images) => {
        const visibleImage = Array.from($images).find((image) => {
          const rect = image.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        });
        expect(visibleImage, 'visible SVG preview image').not.to.equal(undefined);
        expect(visibleImage?.getAttribute('src')).to.match(/^data:image\/svg\+xml;charset=utf-8,/);
      });
      cy.get(`img[alt="${SVG_ALT}"]`).parents('figure').find('svg').should('not.exist');
      cy.contains('button', 'Lưu đề').should('be.enabled').click();
      cy.wait('@saveQuiz');
    });
  });

  it('survives a student reload, stays responsive at 320px and submits normally', () => {
    cy.viewport(320, 720);
    cy.intercept('GET', '**/api/system-settings*', {
      statusCode: 200,
      body: { status: 'success', data: { aiAssistantEnabled: false } },
    });
    cy.intercept('POST', '**/api/validate', {
      statusCode: 200,
      body: {
        status: 'success',
        score: 10,
        correctCount: 1,
        total: 1,
        gradingVersion: 'canonical-v1',
        details: [{ questionId: 'svg-mcq', isCorrect: true, status: 'correct' }],
      },
    }).as('validateSvgAnswer');

    cy.visit('/', { onBeforeLoad: installStudentQuiz });
    cy.reload();
    cy.contains('Bài làm có hình SVG', { timeout: 15_000 }).should('be.visible');
    cy.get('input[placeholder="Ví dụ: Lò Văn A"]').type('Học sinh SVG');
    cy.get('select').select('4A1');
    cy.contains('button', 'Bắt đầu làm bài!').click();

    cy.get(`img[alt="${SVG_ALT}"]`).should('be.visible');
    cy.document().then((document) => {
      expect(document.documentElement.scrollWidth).to.be.lte(document.documentElement.clientWidth + 1);
    });
    cy.get('#question-svg-mcq').find('button').first().click();
    cy.contains('button:visible', 'Nộp bài').click();
    cy.contains('button', 'Đồng ý nộp').click();
    cy.wait('@validateSvgAnswer');
    cy.contains('10/10').should('be.visible');
  });
});
