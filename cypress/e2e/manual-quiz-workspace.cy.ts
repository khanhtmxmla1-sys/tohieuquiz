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

const RESPONSIVE_DRAFT_TITLE = 'Đề kiểm tra responsive với tiêu đề dài cần giữ gọn trên mọi kích thước màn hình';

const responsiveDraft = () => {
    const draft = validDraft();
    draft.draftId = 'manual-e2e-responsive-draft';
    draft.quiz.title = RESPONSIVE_DRAFT_TITLE;
    draft.quiz.questions[0].question = [
        'Đây là một câu hỏi có nội dung rất dài để kiểm tra cách bố trí hàng tổng quan, vùng nội dung và nút chỉnh sửa trên các màn hình hẹp.',
        'Nội dung này cần được xuống dòng tự nhiên, không làm tràn ngang trang hoặc đẩy thao tác chính ra ngoài vùng nhìn thấy của giáo viên.',
    ].join(' ');
    return draft;
};

const twoQuestionDraft = () => {
    const draft = validDraft();
    draft.draftId = 'manual-e2e-two-question-draft';
    draft.selectedQuestionId = 'manual-e2e-question-1';
    draft.quiz.questions = [
        {
            ...draft.quiz.questions[0],
            id: 'manual-e2e-question-1',
            question: 'Câu hỏi số một',
        },
        {
            ...draft.quiz.questions[0],
            id: 'manual-e2e-question-2',
            question: 'Câu hỏi số hai',
            correctAnswer: 'A',
        },
    ];
    draft.quiz.questions[0].points = 5;
    draft.quiz.questions[1].points = 5;
    return draft;
};

const invalidTwoQuestionDraft = () => {
    const draft = twoQuestionDraft();
    draft.quiz.questions[1] = {
        ...draft.quiz.questions[1],
        question: 'Câu hỏi lỗi thứ hai',
        options: [],
        correctAnswer: '',
    };
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
        expect(win.document.body.scrollWidth, 'body scroll width')
            .to.be.lte(win.document.body.clientWidth + 1);
        const overflowingElements = Array.from(win.document.querySelectorAll<HTMLElement>('[data-testid="manual-quiz-workspace"], [data-testid="manual-quiz-workspace"] *'))
            .filter((element) => {
                const style = win.getComputedStyle(element);
                return element.scrollWidth > element.clientWidth + 1
                    && element.getClientRects().length > 0
                    && !element.classList.contains('sr-only')
                    && element.tagName !== 'INPUT'
                    && ['auto', 'scroll'].includes(style.overflowX);
            })
            .map((element) => ({
                tag: element.tagName,
                testId: element.dataset.testid,
                className: element.className,
                scrollWidth: element.scrollWidth,
                clientWidth: element.clientWidth,
            }));
        expect(overflowingElements, 'workspace descendants with horizontal overflow').to.deep.eq([]);
    });
};

const assertResponsiveBounds = () => {
    cy.window().then((win) => {
        const viewportWidth = win.innerWidth;
        const header = win.document.querySelector('header[aria-label="Thanh công cụ Trình soạn đề"]');
        expect(header, 'workspace header').to.exist;
        const headerRect = header!.getBoundingClientRect();
        expect(headerRect.left, 'header left').to.be.at.least(-1);
        expect(headerRect.right, 'header right').to.be.at.most(viewportWidth + 1);
        const titleInput = win.document.querySelector<HTMLElement>('#manual-quiz-title');
        expect(titleInput, 'title input').to.exist;
        const titleRect = titleInput!.getBoundingClientRect();
        const minimumTitleWidth = viewportWidth <= 320 ? 160 : viewportWidth <= 768 ? 240 : 320;
        expect(titleRect.width, 'title input usable width').to.be.at.least(minimumTitleWidth);

        [
            'button[aria-label="Quay lại trang tạo đề"]',
            'button[aria-label="Mở thiết lập đề"]',
            'button[aria-label="Mở xem trước"]',
            'button[aria-label="Kiểm tra và xuất bản"]',
        ].forEach((selector) => {
            const element = win.document.querySelector<HTMLElement>(selector);
            expect(element, `${selector} exists`).to.exist;
            const rect = element!.getBoundingClientRect();
            expect(rect.left, `${selector} left`).to.be.at.least(-1);
            expect(rect.right, `${selector} right`).to.be.at.most(viewportWidth + 1);
            expect(rect.width, `${selector} width`).to.be.greaterThan(0);
        });

        const row = win.document.querySelector<HTMLElement>('[data-testid="workspace-view-overview"] [data-question-id]');
        const editButton = win.document.querySelector<HTMLElement>('[data-testid="workspace-view-overview"] button[aria-label="Sửa câu 1"]');
        const scrollRegion = win.document.querySelector<HTMLElement>('[data-testid="question-navigator-scroll"]');
        expect(row, 'overview question row').to.exist;
        expect(editButton, 'overview edit action').to.exist;
        expect(scrollRegion, 'overview scroll region').to.exist;
        const rowRect = row!.getBoundingClientRect();
        const editRect = editButton!.getBoundingClientRect();
        const scrollRect = scrollRegion!.getBoundingClientRect();
        expect(rowRect.left, 'row left').to.be.at.least(-1);
        expect(rowRect.right, 'row right').to.be.at.most(viewportWidth + 1);
        expect(editRect.left, 'edit action left').to.be.at.least(-1);
        expect(editRect.right, 'edit action right').to.be.at.most(viewportWidth + 1);
        expect(editRect.top, 'edit action visible below scroll region').to.be.at.least(scrollRect.top - 1);
        expect(editRect.bottom, 'edit action visible above scroll region').to.be.at.most(scrollRect.bottom + 1);
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
        cy.get('button[aria-label="Sửa câu 1"]').click();
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

    it('opens a recovered quiz in the full-width question overview', () => {
        visitManualWorkspace(validDraft());
        continueRecoveredDraft('Đề kiểm tra E2E');

        cy.get('[data-testid="workspace-view-overview"]').should('be.visible');
        cy.get('[data-testid="workspace-view-edit"]').should('not.be.visible');
    });

    it('enters the focused editor after adding the first question to a new quiz', () => {
        visitManualWorkspace();
        cy.wait('@accountProfile', { timeout: 15_000 });
        cy.get('[data-testid="manual-quiz-workspace"]', { timeout: 15_000 }).should('be.visible');

        cy.get('[data-testid="workspace-view-overview"]').should('be.visible');
        cy.get('[data-testid="workspace-view-overview"]').contains('button', 'Thêm câu').click();
        cy.get('[role="dialog"][aria-label="Chọn dạng câu hỏi"]')
            .should('be.visible')
            .find('button[aria-label="Thêm dạng Trắc nghiệm một đáp án"]')
            .click();

        cy.get('[data-testid="workspace-view-edit"]').should('be.visible');
        cy.get('[data-testid="workspace-view-overview"]').should('not.be.visible');
        cy.get('[data-testid="question-rich-editor"]').should('be.visible');
    });

    it('keeps the latest draft when switching from focused editing to preview and back', () => {
        visitManualWorkspace(validDraft());
        continueRecoveredDraft('Đề kiểm tra E2E');

        cy.get('[data-testid="workspace-view-overview"]').should('be.visible');
        cy.get('button[aria-label="Sửa câu 1"]').click();

        cy.get('[data-testid="question-rich-editor"]')
            .click()
            .type('{ctrl}a')
            .type('{backspace}')
            .type('Nội dung xem trước', { delay: 0 })
            .should('contain.text', 'Nội dung xem trước');
        cy.contains('button', 'Xem trước').click();

        cy.get('[data-testid="workspace-view-preview"]')
            .should('be.visible')
            .and('contain.text', 'Nội dung xem trước');
        cy.get('[data-testid="workspace-view-edit"]').should('not.be.visible');
        cy.contains('button', 'Quay lại sửa').click();
        cy.get('[data-testid="workspace-view-edit"]').should('be.visible');
        cy.get('[data-testid="question-rich-editor"]').should('contain.text', 'Nội dung xem trước');
    });

    it('blocks next and overview navigation when local persistence fails', () => {
        visitManualWorkspace(twoQuestionDraft());
        continueRecoveredDraft('Đề kiểm tra E2E');

        cy.get('[data-testid="workspace-view-overview"]').should('be.visible');
        cy.get('button[aria-label="Sửa câu 1"]').click();
        cy.get('[data-testid="workspace-view-edit"]').should('be.visible');

        cy.window().then((win) => {
            const originalSetItem = win.localStorage.setItem.bind(win.localStorage);
            cy.stub(win.Storage.prototype, 'setItem').callsFake((key, value) => {
                if (String(key).includes('tohieuquiz:manual-draft:')) {
                    throw new DOMException('Quota exceeded', 'QuotaExceededError');
                }
                originalSetItem(key, value);
            });
        });

        cy.get('[data-testid="question-rich-editor"]')
            .click()
            .type('{ctrl}a')
            .type('{backspace}')
            .type('Nội dung chưa lưu', { delay: 0 })
            .should('contain.text', 'Nội dung chưa lưu');
        cy.contains('button', 'Lưu và câu sau').click();
        cy.get('[data-testid="workspace-view-edit"]').should('be.visible');
        cy.get('[data-testid="question-rich-editor"]').should('contain.text', 'Nội dung chưa lưu');
        cy.contains(/chưa thể lưu bản nháp|bộ nhớ trình duyệt đã đầy/i).should('be.visible');

        cy.contains('button', 'Về danh sách').click();
        cy.get('[data-testid="workspace-view-edit"]').should('be.visible');
        cy.get('[data-testid="workspace-view-overview"]').should('not.be.visible');
    });

    it('opens the correct focused editor when a validation issue targets a question', () => {
        visitManualWorkspace(invalidTwoQuestionDraft());
        continueRecoveredDraft('Đề kiểm tra E2E');

        cy.get('[data-testid="workspace-view-overview"]').should('be.visible');
        cy.contains('button', 'Kiểm tra và xuất bản').click();
        cy.get('[role="dialog"][aria-label="Kiểm tra trước khi xuất bản"]').should('be.visible');
        cy.contains('[role="dialog"] button', 'Đi đến câu').first().click();

        cy.get('[data-testid="workspace-view-edit"]').should('be.visible');
        cy.get('[data-testid="question-rich-editor"]').should('contain.text', 'Câu hỏi lỗi thứ hai');
    });

    it('flushes a just-typed question before switching navigator rows', () => {
        visitManualWorkspace(twoQuestionDraft());
        continueRecoveredDraft('Đề kiểm tra E2E');
        cy.get('button[aria-label="Sửa câu 1"]').click();

        cy.get('[data-testid="question-rich-editor"]')
            .click()
            .type('{ctrl}a{backspace}')
            .type('Noi dung vua go');
        cy.get('[data-testid="question-rich-editor"]').should('contain.text', 'Noi dung vua go');
        cy.window().then((win) => {
            const raw = win.localStorage.getItem(
                `tohieuquiz:manual-draft:v1:${TEACHER}:manual-e2e-two-question-draft`,
            );
            expect(JSON.parse(raw!).quiz.questions[0].question).to.eq('Câu hỏi số một');
        });
        cy.contains('button', 'Về danh sách').click();
        cy.get('[data-testid="workspace-view-overview"]').should('be.visible');
        cy.get('button[aria-label="Chọn câu 2: Câu hỏi số hai"]').click();
        cy.get('[data-testid="question-rich-editor"]').should('contain.text', 'Câu hỏi số hai');
        cy.window().then((win) => {
            const raw = win.localStorage.getItem(
                `tohieuquiz:manual-draft:v1:${TEACHER}:manual-e2e-two-question-draft`,
            );
            expect(raw).to.be.a('string');
            expect(JSON.parse(raw!).quiz.questions[0].question).to.eq('Noi dung vua go');
        });
    });

    it('keeps the current question selected when immediate local persistence fails', () => {
        visitManualWorkspace(twoQuestionDraft());
        continueRecoveredDraft('Đề kiểm tra E2E');
        cy.get('button[aria-label="Sửa câu 1"]').click();

        cy.window().then((win) => {
            const originalSetItem = win.localStorage.setItem.bind(win.localStorage);
            cy.stub(win.Storage.prototype, 'setItem').callsFake((key, value) => {
                if (String(key).includes('tohieuquiz:manual-draft:')) {
                    throw new DOMException('Quota exceeded', 'QuotaExceededError');
                }
                originalSetItem(key, value);
            });
        });
        cy.get('[data-testid="question-rich-editor"]')
            .click()
            .type('{ctrl}a{backspace}')
            .type('Noi dung chua luu');
        cy.get('[data-testid="question-rich-editor"]').should('contain.text', 'Noi dung chua luu');
        cy.contains('button', 'Lưu và câu sau').click();

        cy.get('[data-testid="question-rich-editor"]').should('contain.text', 'Noi dung chua luu');
        cy.contains(/Bộ nhớ trình duyệt đã đầy|chưa thể lưu bản nháp/i).should('be.visible');
    });

    it('preserves Enter formatting through draft save, reload and publish', () => {
        visitManualWorkspace(validDraft());
        continueRecoveredDraft('Đề kiểm tra E2E');
        cy.get('button[aria-label="Sửa câu 1"]').click();

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
        cy.get('button[aria-label="Sửa câu 1"]').click();
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
        cy.get('button[aria-label="Sửa câu 1"]').click();

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

    it('keeps DROPDOWN content leakage in review instead of marking it ready to import', () => {
        visitManualWorkspace(validDraft());
        continueRecoveredDraft('Đề kiểm tra E2E');

        cy.contains('button', 'Nhập từ tệp').click();
        cy.get('[role="dialog"][aria-label="Nhập câu hỏi"]').should('be.visible');
        cy.contains('[role="tab"]', 'Dán JSON').click();

        const payload = JSON.stringify([{
            question_type: 'DROPDOWN',
            question: 'Chọn từ so sánh thích hợp để điền vào câu ca dao sau.\nCông cha {{select1}} núi Thái Sơn\nNghĩa mẹ {{select2}} nước trong nguồn chảy ra.',
            content: 'Công cha {{select1}} núi Thái Sơn\nNghĩa mẹ {{select2}} nước trong nguồn chảy ra.',
            dropdowns: [
                { id: 'select1', options: ['như', 'tựa'], correct_answer: 'như' },
                { id: 'select2', options: ['như', 'tựa'], correct_answer: 'như' },
            ],
        }]);

        cy.get<HTMLTextAreaElement>('textarea[aria-label="Dữ liệu JSON"]').then(($textarea) => {
            const textarea = $textarea[0];
            const view = textarea.ownerDocument.defaultView!;
            const valueSetter = Object.getOwnPropertyDescriptor(view.HTMLTextAreaElement.prototype, 'value')?.set;
            expect(valueSetter, 'native textarea value setter').to.be.a('function');
            valueSetter!.call(textarea, payload);
            textarea.dispatchEvent(new view.Event('input', { bubbles: true }));
        });
        cy.get('textarea[aria-label="Dữ liệu JSON"]').should('have.value', payload);
        cy.contains('button', 'Kiểm tra JSON').click();

        cy.contains('0 sẵn sàng').should('be.visible');
        cy.contains('1 cần rà soát').should('be.visible');
        cy.contains(/^Câu DROPDOWN đang đưa \{\{select\.\.\.\}\} vào question/).should('exist');
        cy.get('button[aria-label="Nhập 0 câu đã chọn"]').should('be.disabled');
    });

    [
        { width: 320, height: 800, label: 'mobile-320' },
        { width: 768, height: 1024, label: 'tablet-768' },
        { width: 1024, height: 768, label: 'tablet-1024' },
        { width: 1280, height: 800, label: 'desktop-1280' },
        { width: 1440, height: 900, label: 'desktop-1440' },
        { width: 1920, height: 1080, label: 'desktop-1920' },
    ].forEach(({ width, height, label }) => {
        it(`has no horizontal overflow and captures ${label}`, () => {
            cy.viewport(width, height);
            visitManualWorkspace(responsiveDraft());
            continueRecoveredDraft(RESPONSIVE_DRAFT_TITLE);
            cy.get('button[aria-label="Thêm ảnh đính kèm"]')
                .should('have.attr', 'aria-expanded', 'false');
            cy.contains('Chọn, kéo thả hoặc dán ảnh').should('not.exist');
            assertNoHorizontalOverflow();
            assertResponsiveBounds();
            if (width <= 768) {
                cy.get('[data-testid="workspace-view-overview"] button[aria-label="Sửa câu 1"]')
                    .scrollIntoView()
                    .should('be.visible');
                cy.window().then((win) => {
                    cy.get('header[aria-label="Thanh công cụ Trình soạn đề"]').should(($header) => {
                        const headerRect = $header[0].getBoundingClientRect();
                        expect(headerRect.top, 'sticky header top').to.be.at.least(-1);
                        expect(headerRect.bottom, 'sticky header remains in viewport').to.be.at.most(win.innerHeight + 1);
                    });
                });
                cy.get('[data-testid="workspace-view-overview"] button[aria-label="Sửa câu 1"]').then(($button) => {
                    const buttonRect = $button[0].getBoundingClientRect();
                    cy.get('header[aria-label="Thanh công cụ Trình soạn đề"]').then(($header) => {
                        expect(buttonRect.top, 'question action below sticky header').to.be.at.least(
                            $header[0].getBoundingClientRect().bottom - 1,
                        );
                    });
                });
            }
            cy.screenshot(`manual-quiz-workspace/${label}`, { capture: 'viewport' });
        });
    });
});
