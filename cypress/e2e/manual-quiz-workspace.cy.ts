const TEACHER = 'manual-e2e-teacher';

const authStorageValue = JSON.stringify({
    state: {
        isLoggedIn: true,
        username: TEACHER,
        teacherName: 'Cô E2E',
        isAdmin: false,
        teacherClass: '3A',
    },
    version: 0,
});

const validDraft = () => {
    const now = new Date().toISOString();
    return {
        schemaVersion: 1,
        draftId: 'manual-e2e-draft',
        ownerUsername: TEACHER,
        revision: 0,
        selectedQuestionId: 'manual-e2e-question',
        targetPoints: 10,
        updatedAt: now,
        quiz: {
            id: 'manual-e2e-quiz',
            title: 'Đề kiểm tra E2E',
            classLevel: '3',
            category: 'toan',
            topic: 'Toán',
            tags: ['e2e'],
            timeLimit: 15,
            createdAt: now,
            requireCode: false,
            showOnHome: true,
            questions: [{
                id: 'manual-e2e-question',
                type: 'MCQ',
                question: 'Hai cộng ba bằng bao nhiêu?',
                options: ['4', '5', '6', '7'],
                correctAnswer: 'B',
                difficulty: 1,
                points: 10,
                explanation: 'Hai cộng ba bằng năm.',
            }],
        },
    };
};

const longDraft = () => {
    const draft = validDraft();
    draft.draftId = 'manual-e2e-long-draft';
    draft.selectedQuestionId = 'manual-e2e-question-1';
    draft.quiz.title = 'Đề 30 câu E2E';
    draft.quiz.questions = Array.from({ length: 30 }, (_, index) => ({
        id: `manual-e2e-question-${index + 1}`,
        type: 'MCQ',
        question: `Câu hỏi số ${index + 1}`,
        options: ['1', '2', '3', '4'],
        correctAnswer: 'A',
        difficulty: 1,
        points: index === 29 ? 0.43 : 0.33,
        explanation: `Giải thích câu ${index + 1}.`,
    }));
    return draft;
};

const installAuth = (win: Window) => {
    win.localStorage.setItem('auth-storage', authStorageValue);
};

const installDraft = (win: Window, draft = validDraft()) => {
    installAuth(win);
    win.localStorage.setItem(
        `tohieuquiz:manual-draft:v1:${TEACHER}:${draft.draftId}`,
        JSON.stringify(draft),
    );
    win.localStorage.setItem(
        `tohieuquiz:manual-draft:index:v1:${TEACHER}`,
        JSON.stringify([{
            draftId: draft.draftId,
            updatedAt: draft.updatedAt,
        }]),
    );
};

const interceptManualQuizBackend = () => {
    cy.intercept('GET', '**/api/quizzes*', {
        statusCode: 200,
        body: { status: 'success', data: [] },
    }).as('initialQuizzes');
    cy.intercept('GET', '**/api/questions*', {
        statusCode: 200,
        body: { status: 'success', data: [] },
    }).as('initialQuestions');
    cy.intercept('GET', '**/api/system-settings*', {
        statusCode: 200,
        body: { status: 'success', data: { aiAssistantEnabled: false } },
    }).as('systemSettings');
    cy.intercept('GET', '**/api/account/me', {
        statusCode: 200,
        body: {
            data: {
                username: TEACHER,
                fullName: 'Cô E2E',
                role: 'teacher',
                classes: [{ id: 'class-3a', name: '3A' }],
                mustChangePassword: false,
            },
        },
    }).as('accountProfile');
    cy.intercept('PUT', '**/api/quiz-drafts/*', (request) => {
        const draft = request.body.draft;
        if (draft?.quiz?.timeLimit === 45) request.alias = 'saveTimeDraft';
        if (draft?.quiz?.questions?.some((question: any) => question?.questionRichText?.schemaVersion === 1)) {
            request.alias = 'saveRichDraft';
        }
        if (draft?.quiz?.questions?.some((question: any) => question?.question === '1 + 1 bằng bao nhiêu?')) {
            request.alias = 'saveCompleteQuestionDraft';
        }
        const revision = Number(request.body.expectedRevision || 0) + 1;
        request.reply({
            statusCode: 200,
            body: {
                id: draft.draftId,
                quizId: draft.quizId,
                ownerUsername: draft.ownerUsername,
                revision,
                updatedAt: new Date().toISOString(),
                draft: { ...draft, revision },
            },
        });
    }).as('saveDraft');
    cy.intercept('DELETE', '**/api/quiz-drafts/*', {
        statusCode: 200,
        body: { status: 'success', id: 'manual-e2e-draft' },
    }).as('deleteDraft');
    cy.intercept('POST', '**/api/quizzes', {
        statusCode: 200,
        body: { status: 'success', id: 'published-e2e-quiz' },
    }).as('publishQuiz');
};

const visitManualWorkspace = (draft?: ReturnType<typeof validDraft>) => {
    cy.visit('/teacher/quizzes/new', {
        onBeforeLoad: (win) => {
            if (draft) installDraft(win, draft);
            else installAuth(win);
        },
    });
};

const continueRecoveredDraft = (expectedTitle: string) => {
    cy.get('body', { timeout: 15_000 }).should(($body) => {
        const hasContinue = Array.from($body.find('button'))
            .some((button) => button.textContent?.includes('Tiếp tục soạn'));
        const currentTitle = String($body.find('#manual-quiz-title').val() || '');
        expect(
            hasContinue || currentTitle === expectedTitle,
            'recovery action or hydrated draft title',
        ).to.eq(true);
    }).then(($body) => {
        const button = Array.from($body.find('button'))
            .find((item) => item.textContent?.includes('Tiếp tục soạn'));
        if (button) cy.wrap(button).click({ force: true });
    });
    cy.get('[data-testid="manual-quiz-workspace"]', { timeout: 15_000 }).should('be.visible');
    cy.get('#manual-quiz-title', { timeout: 15_000 }).should('have.value', expectedTitle);
};

const assertNoHorizontalOverflow = () => {
    cy.window().then((win) => {
        const documentElement = win.document.documentElement;
        expect(documentElement.scrollWidth, 'document scroll width')
            .to.be.lte(documentElement.clientWidth + 1);
    });
};

describe('Manual quiz workspace end-to-end', () => {
    beforeEach(() => {
        interceptManualQuizBackend();
    });

    it('creates a draft, saves immediately, survives reload and reconnects after offline editing', () => {
        visitManualWorkspace();
        cy.wait('@accountProfile', { timeout: 15_000 });
        cy.get('[data-testid="manual-quiz-workspace"]', { timeout: 15_000 }).should('be.visible');

        cy.get('#manual-quiz-title').clear({ force: true }).type('Đề đang tự động lưu', { force: true });
        cy.get('button[aria-label="Thêm nhanh Trắc nghiệm"]').click();
        cy.get('[data-testid="question-rich-editor"]')
            .click()
            .type('{ctrl}a')
            .type('{backspace}1 + 1 bằng bao nhiêu?')
            .should('contain.text', '1 + 1 bằng bao nhiêu?');
        cy.get('input[placeholder="Đáp án A"]').type('1');
        cy.get('input[placeholder="Đáp án B"]').type('2');
        cy.get('input[placeholder="Đáp án C"]').type('3');
        cy.get('input[placeholder="Đáp án D"]').type('4');
        cy.get('input[placeholder="A, B, C hoặc D"]').type('B');
        cy.get('input[aria-label="Điểm câu hỏi"]').clear().type('10');
        cy.contains('button', 'Lưu câu hỏi').click();
        cy.get('body').type('{ctrl}s');
        cy.wait('@saveCompleteQuestionDraft', { timeout: 15_000 }).then(({ request }) => {
            expect(request.body.draft.quiz.questions[0].question).to.eq('1 + 1 bằng bao nhiêu?');
            expect(request.body.draft.quiz.questions[0].questionRichText.schemaVersion).to.eq(1);
        });
        cy.contains('Đã tự động lưu').should('be.visible');

        cy.reload();
        cy.wait('@accountProfile', { timeout: 15_000 });
        continueRecoveredDraft('Đề đang tự động lưu');
        cy.get('[data-testid="question-rich-editor"]', { timeout: 15_000 })
            .should('contain.text', '1 + 1 bằng bao nhiêu?');

        cy.window().then((win) => {
            Object.defineProperty(win.navigator, 'onLine', { configurable: true, value: false });
            win.dispatchEvent(new Event('offline'));
        });
        cy.get('#manual-quiz-title').clear({ force: true }).type('Đề sửa khi ngoại tuyến', { force: true });
        cy.contains('Ngoại tuyến – đã lưu trên thiết bị').should('be.visible');

        cy.window().then((win) => {
            Object.defineProperty(win.navigator, 'onLine', { configurable: true, value: true });
            win.dispatchEvent(new Event('online'));
        });
        cy.wait('@saveDraft', { timeout: 15_000 });
        cy.contains('Đã tự động lưu').should('be.visible');
    });

    it('scrolls the question navigator independently to the final question', () => {
        cy.viewport(1440, 900);
        visitManualWorkspace(longDraft());
        continueRecoveredDraft('Đề 30 câu E2E');

        let pageScrollBeforeNavigator = 0;
        cy.window().then((win) => {
            pageScrollBeforeNavigator = win.scrollY;
        });

        cy.get('[data-testid="question-navigator-scroll"]').should(($region) => {
            const element = $region[0];
            expect(element.scrollHeight, 'navigator scroll height').to.be.greaterThan(element.clientHeight);
        }).scrollTo('bottom');

        cy.window().then((win) => {
            expect(win.scrollY, 'page scroll position after navigator scroll').to.eq(pageScrollBeforeNavigator);
        });
        cy.get('button[aria-label^="Chọn câu 30:"]').should('be.visible').click();
        cy.get('[data-testid="question-rich-editor"]').should('contain.text', 'Câu hỏi số 30');
    });

    it('preserves Enter formatting through draft save, reload and publish', () => {
        visitManualWorkspace(validDraft());
        continueRecoveredDraft('Đề kiểm tra E2E');

        cy.get('[data-testid="question-rich-editor"]')
            .click()
            .type('{ctrl}a{backspace}');
        cy.get('button[aria-label="In đậm"]').click();
        cy.get('[data-testid="question-rich-editor"]').type('Dòng thứ nhất');
        cy.get('button[aria-label="In đậm"]').click();
        cy.get('[data-testid="question-rich-editor"]').type('{enter}');
        cy.get('button[aria-label="Căn giữa"]').click();
        cy.get('[data-testid="question-rich-editor"]').type('Dòng thứ hai');
        cy.contains('button', 'Lưu câu hỏi').click();
        cy.get('body').type('{ctrl}s');

        cy.wait('@saveRichDraft', { timeout: 15_000 }).then(({ request }) => {
            const saved = request.body.draft.quiz.questions[0];
            expect(saved.question).to.eq('Dòng thứ nhất\nDòng thứ hai');
            expect(saved.questionRichText.schemaVersion).to.eq(1);
            expect(saved.questionRichText.doc.content[0].content[0].marks).to.deep.include({ type: 'bold' });
            expect(saved.questionRichText.doc.content[1].attrs.textAlign).to.eq('center');
        });

        cy.reload();
        cy.wait('@accountProfile', { timeout: 15_000 });
        continueRecoveredDraft('Đề kiểm tra E2E');
        cy.get('[data-testid="question-rich-editor"] strong').should('contain.text', 'Dòng thứ nhất');
        cy.get('[data-testid="question-rich-editor"] p').eq(1).should('have.attr', 'style').and('contain', 'text-align: center');

        cy.contains('button', 'Kiểm tra và xuất bản').click();
        cy.contains('button', 'Xuất bản đề').click();
        cy.wait('@publishQuiz').then(({ request }) => {
            expect(request.body.questions[0].question).to.eq('Dòng thứ nhất\nDòng thứ hai');
            expect(request.body.questions[0].questionRichText.schemaVersion).to.eq(1);
        });
    });

    it('serializes Shift+Enter as a hard break while keeping the plain newline fallback', () => {
        visitManualWorkspace(validDraft());
        continueRecoveredDraft('Đề kiểm tra E2E');

        cy.get('[data-testid="question-rich-editor"]')
            .click()
            .type('{ctrl}a{backspace}Dòng 1')
            .trigger('keydown', { key: 'Enter', code: 'Enter', shiftKey: true });
        cy.get('[data-testid="question-rich-editor"]').type('Dòng 2');
        cy.contains('button', 'Lưu câu hỏi').click();
        cy.get('body').type('{ctrl}s');

        cy.wait('@saveRichDraft', { timeout: 15_000 }).then(({ request }) => {
            const saved = request.body.draft.quiz.questions[0];
            expect(saved.question).to.eq('Dòng 1\nDòng 2');
            expect(saved.questionRichText.doc.content).to.have.length(1);
            expect(saved.questionRichText.doc.content[0].content.some((node: any) => node.type === 'hardBreak')).to.eq(true);
        });
    });

    it('persists the configured duration and publishes the same value', () => {
        visitManualWorkspace(validDraft());
        continueRecoveredDraft('Đề kiểm tra E2E');

        cy.get('button[aria-label="Mở thiết lập đề"]').click();
        cy.get('#manual-quiz-time-limit').clear().type('45');
        cy.get('button[aria-label="Áp dụng thiết lập"]').click();
        cy.wait('@saveTimeDraft', { timeout: 15_000 })
            .its('request.body.draft.quiz.timeLimit')
            .should('eq', 45);

        cy.reload();
        cy.wait('@accountProfile', { timeout: 15_000 });
        continueRecoveredDraft('Đề kiểm tra E2E');
        cy.get('button[aria-label="Mở thiết lập đề"]').click();
        cy.get('#manual-quiz-time-limit').should('have.value', '45');
        cy.get('button[aria-label="Đóng thiết lập đề"]').click();

        cy.contains('button', 'Kiểm tra và xuất bản').click();
        cy.contains('button', 'Xuất bản đề').click();
        cy.wait('@publishQuiz').its('request.body.timeLimit').should('eq', 45);
        cy.wait('@deleteDraft');
    });

    it('validates a recovered draft and publishes exactly once', () => {
        visitManualWorkspace(validDraft());
        continueRecoveredDraft('Đề kiểm tra E2E');
        cy.contains('button', 'Kiểm tra và xuất bản').click();
        cy.get('[role="dialog"][aria-label="Kiểm tra trước khi xuất bản"]').should('be.visible');
        cy.contains('Cần sửa hết lỗi bắt buộc trước khi xuất bản.').should('not.exist');
        cy.contains('button', 'Xuất bản đề').click();
        cy.wait('@publishQuiz');
        cy.wait('@deleteDraft');
        cy.location('pathname', { timeout: 15_000 }).should('eq', '/teacher/quizzes');
    });

    [
        { width: 320, height: 800, label: 'mobile-320' },
        { width: 768, height: 1024, label: 'tablet-768' },
        { width: 1024, height: 768, label: 'tablet-1024' },
        { width: 1440, height: 900, label: 'desktop-1440' },
    ].forEach(({ width, height, label }) => {
        it(`has no horizontal overflow and captures ${label}`, () => {
            cy.viewport(width, height);
            visitManualWorkspace(validDraft());
            continueRecoveredDraft('Đề kiểm tra E2E');
            cy.get('button[aria-label="Thêm ảnh đính kèm"]')
                .should('have.attr', 'aria-expanded', 'false');
            cy.contains('Chọn, kéo thả hoặc dán ảnh').should('not.exist');
            assertNoHorizontalOverflow();
            cy.screenshot(`manual-quiz-workspace/${label}`, { capture: 'viewport' });
        });
    });
});
