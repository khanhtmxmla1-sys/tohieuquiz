const TEACHER = 'ai-v3-e2e-teacher';

const authStorageValue = JSON.stringify({
  state: {
    isLoggedIn: true,
    username: TEACHER,
    teacherName: 'Cô Blueprint V3',
    isAdmin: false,
    teacherClass: '4A',
  },
  version: 0,
});

const dashboardStorageValue = JSON.stringify({ state: { activeTab: 'create' }, version: 2 });
const quizStorageValue = JSON.stringify({
  state: { view: 'teacher_dash', quizzes: [] },
  version: 0,
});

const aiResponse = (payload: unknown) => ({
  choices: [{ message: { content: JSON.stringify(payload) } }],
});

const trialQuiz = {
  promptVersion: 'ai-blueprint-v3',
  blueprintVersion: 3,
  title: 'Bản thử ôn tập lớp 4',
  detectedCategory: 'toan',
  detectedLesson: 'Ôn tập thử',
  suggestedTags: ['ban_thu', 'lop_4'],
  timeLimit: 10,
  questions: [
    {
      slotId: 'slot-1',
      type: 'MCQ',
      difficulty: 1,
      diagramPolicy: 'forbidden',
      question: 'Kết quả của 3 cộng 4 là bao nhiêu?',
      options: ['7', '6', '8', '9'],
      correctAnswer: 'A',
      explanation: 'Ba cộng bốn bằng bảy.',
    },
    {
      slotId: 'slot-2',
      type: 'MATCHING',
      difficulty: 2,
      diagramPolicy: 'forbidden',
      question: 'Nối phép tính với kết quả đúng.',
      pairs: [
        { left: '2 + 2', right: '4' },
        { left: '3 + 2', right: '5' },
        { left: '4 + 2', right: '6' },
      ],
      explanation: 'Tính từng phép cộng rồi nối với kết quả.',
    },
    {
      slotId: 'slot-3',
      type: 'SHORT_ANSWER',
      difficulty: 2,
      diagramPolicy: 'forbidden',
      question: 'Số liền sau của 19 là số nào?',
      correctAnswer: '20',
      explanation: 'Số liền sau của 19 là 20.',
    },
  ],
};

const installSession = (win: Window) => {
  win.localStorage.setItem('auth-storage', authStorageValue);
  win.localStorage.setItem('tohieuquiz_teacher_dashboard_ui', dashboardStorageValue);
  win.localStorage.setItem('tohieuquiz-store', quizStorageValue);
  win.localStorage.setItem('tohieuquiz_teacher_restore_hint', '1');
};

const interceptBootstrap = () => {
  cy.intercept('GET', '**/api/account/me', {
    statusCode: 200,
    body: {
      data: {
        username: TEACHER,
        fullName: 'Cô Blueprint V3',
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
        usageDate: '2026-07-23',
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
};

const visitCreateTab = () => {
  interceptBootstrap();
  cy.visit('/teacher/quizzes?mode=create', { onBeforeLoad: installSession });
  cy.contains('Tạo đề kiểm tra mới', { timeout: 15_000 }).should('be.visible');
  cy.contains('Dạng câu hỏi & ma trận').should('be.visible');
};

const configureThirteenSlots = () => {
  cy.get('body').then(($body) => {
    if (!$body.text().includes('Mức 1: Nhận biết')) {
      cy.contains('button', 'Độ khó & Số lượng').click();
    }
  });
  cy.contains('label', 'Mức 1: Nhận biết').parent().find('input')
    .type('{selectall}4').blur().should('have.value', '4');
  cy.contains('label', 'Mức 2: Thông hiểu').parent().find('input')
    .type('{selectall}5').blur().should('have.value', '5');
  cy.contains('label', 'Mức 3: Vận dụng cao').parent().find('input')
    .type('{selectall}4').blur().should('have.value', '4');

  const labels = [
    'Trắc nghiệm một đáp án',
    'Đúng hoặc Sai',
    'Điền đáp án ngắn',
    'Nối hai cột',
    'Chọn nhiều đáp án',
    'Kéo thả điền khuyết',
    'Sắp xếp thứ tự',
    'Câu hỏi dựa vào hình',
    'Chọn từ danh sách',
    'Gạch chân từ đúng',
    'Phân loại vào nhóm',
    'Ghép chữ thành từ',
    'Giải câu đố',
  ];
  labels.forEach((label) => {
    cy.contains('label', label).find('input[type="checkbox"]').check({ force: true });
  });

  cy.get('input[aria-label^="Số câu "]').should('have.length', 13).then(($inputs) => {
    const total = [...$inputs].reduce((sum, input) => sum + Number((input as HTMLInputElement).value), 0);
    expect(total).to.equal(13);
  });
  cy.contains('Mức 1: 4 · Mức 2: 5 · Mức 3: 4').should('be.visible');
  cy.contains('13 slot đã sẵn sàng').should('be.visible');
  cy.contains('13 dạng câu').should('be.visible');
  cy.get('input[placeholder*="Động vật rừng xanh"]').clear().type('Ôn tập tổng hợp lớp 4');
};

const clickGenerate = () => {
  cy.contains('button', '📚 Ra đề ÔN TẬP').should('be.enabled').click();
};

describe('AI Question Blueprint V3', () => {
  it('creates a representative three-question trial and blocks saving it', () => {
    cy.intercept('POST', '**/api/ai/chat', (request) => {
      expect(request.body._meta.promptVersion).to.equal('ai-blueprint-v3');
      expect(request.body._meta.blueprintVersion).to.equal(3);
      expect(request.body._meta.slotCount).to.equal(3);
      request.reply({ statusCode: 200, body: aiResponse(trialQuiz) });
    }).as('aiTrial');

    visitCreateTab();
    cy.get('input[placeholder*="Động vật rừng xanh"]').clear().type('Ôn tập thử lớp 4');
    cy.contains('Cấu hình trước khi tạo').should('be.visible');
    cy.contains('10 câu · 4 dạng · Dễ 3, Trung bình 5, Khó 2').should('be.visible');
    cy.contains('5/5 lượt còn lại').should('be.visible');

    cy.contains('button', 'Tạo thử 3 câu').click();

    cy.wait('@aiTrial').its('request.body._meta.stage').should('equal', 'GENERATE');
    cy.contains('Bản tạo thử 3 câu', { timeout: 20_000 }).should('be.visible');
    cy.contains('button', 'Lưu đề')
      .should('be.disabled')
      .and('have.attr', 'title', 'Đây là bản tạo thử 3 câu. Hãy tạo đề đầy đủ trước khi lưu.');
  });

  it('generates and renders all thirteen contract types', () => {
    cy.fixture('ai-blueprint-v3-13-types.json').then((validQuiz) => {
      cy.intercept('POST', '**/api/ai/chat', (request) => {
        expect(request.body._meta.promptVersion).to.equal('ai-blueprint-v3');
        expect(request.body._meta.blueprintVersion).to.equal(3);
        expect(request.body._meta.slotCount).to.equal(13);
        request.reply({ statusCode: 200, body: aiResponse(validQuiz) });
      }).as('aiV3');

      visitCreateTab();
      configureThirteenSlots();
      clickGenerate();

      cy.wait('@aiV3');
      cy.contains('Kết quả của 6 cộng 4', { timeout: 20_000 }).should('exist');
      cy.contains('Xác định tính đúng sai').should('exist');
      cy.contains('Nối phép tính với kết quả').should('exist');
      cy.contains('Chọn tất cả các số chẵn').should('exist');
      cy.contains('Nước đóng băng').should('exist');
      cy.contains('Phân loại các con vật').should('exist');
      cy.contains('Em hãy giải câu đố').should('exist');
      cy.contains('button', 'Lưu đề').should('be.enabled');
    });
  });

  it('repairs only the wrong slot and regenerates one question with a new action', () => {
    cy.fixture('ai-blueprint-v3-13-types.json').then((validQuiz: any) => {
      const wrongDraft = structuredClone(validQuiz);
      wrongDraft.questions[5] = {
        slotId: 'slot-6',
        type: 'MCQ',
        difficulty: 2,
        diagramPolicy: validQuiz.questions[5].diagramPolicy,
        question: 'Câu sai type cố ý.',
        options: ['1', '2', '3', '4'],
        correctAnswer: 'A',
        explanation: 'Fixture cố ý sai type.',
      };
      const repairedSlot = {
        promptVersion: 'ai-blueprint-v3',
        blueprintVersion: 3,
        title: 'Phần sửa',
        questions: [validQuiz.questions[5]],
      };
      const regeneratedQuestion = {
        promptVersion: 'ai-blueprint-v3',
        blueprintVersion: 3,
        title: 'Câu sinh lại',
        questions: [{
          ...validQuiz.questions[0],
          question: 'Kết quả mới của 7 cộng 5 là bao nhiêu?',
          options: ['12', '11', '13', '14'],
          explanation: 'Cộng 7 với 5 được 12.',
        }],
      };
      let createActionId = '';
      let sawRepair = false;
      let sawRegenerate = false;

      cy.intercept('POST', '**/api/ai/chat', (request) => {
        const meta = request.body?._meta;
        if (meta.workflow === 'QUESTION_REGENERATE') {
          sawRegenerate = true;
          expect(meta.stage).to.equal('REGENERATE');
          expect(meta.actionId).not.to.equal(createActionId);
          request.reply({ statusCode: 200, body: aiResponse(regeneratedQuestion) });
          return;
        }
        createActionId ||= meta.actionId;
        if (meta.stage === 'GENERATE') {
          request.reply({ statusCode: 200, body: aiResponse(wrongDraft) });
          return;
        }
        if (meta.stage === 'REPAIR') {
          sawRepair = true;
          expect(request.body.messages[1].content).to.contain('slot-6');
          expect(request.body.messages[1].content).not.to.contain('slot-1\",\"type');
          request.reply({ statusCode: 200, body: aiResponse(repairedSlot) });
          return;
        }
        request.reply({ statusCode: 200, body: aiResponse(validQuiz) });
      }).as('aiV3Stages');

      visitCreateTab();
      configureThirteenSlots();
      clickGenerate();
      cy.wait('@aiV3Stages').its('request.body._meta.stage').should('equal', 'GENERATE');
      cy.wait('@aiV3Stages').its('request.body._meta.stage').should('equal', 'REPAIR');
      cy.contains('Nước đóng băng', { timeout: 20_000 }).should('exist');
      cy.then(() => expect(sawRepair).to.equal(true));

      cy.get('button[title="Sinh lại câu hỏi này (AI)"]').first().scrollIntoView().click();
      cy.contains('Kết quả mới của 7 cộng 5', { timeout: 20_000 }).should('be.visible');
      cy.contains('AI đã thay đổi một câu hỏi').should('be.visible');
      cy.then(() => expect(sawRegenerate).to.equal(true));

      cy.contains('button', 'Hoàn tác lần sinh lại này').click();
      cy.contains('Kết quả của 6 cộng 4', { timeout: 10_000 }).should('be.visible');
      cy.contains('AI đã thay đổi một câu hỏi').should('not.exist');
    });
  });
});
