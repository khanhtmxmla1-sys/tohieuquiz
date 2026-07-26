describe('Student Quiz Flow', () => {
    beforeEach(() => {
        cy.visit('/');
    });

    it('should display home page with class levels', () => {
        // Check home page loads
        cy.contains('TRƯỜNG TIỂU HỌC IT ÔNG').should('be.visible');

        // Check class level buttons exist
        cy.contains('Lớp 1').should('be.visible');
        cy.contains('Lớp 2').should('be.visible');
        cy.contains('Lớp 3').should('be.visible');
        cy.contains('Lớp 4').should('be.visible');
        cy.contains('Lớp 5').should('be.visible');
    });

    it('should navigate to class level and show quizzes', () => {
        // Click on a class level
        cy.contains('Lớp 2').click();

        // Should show quiz list or empty message
        cy.get('body').then(($body) => {
            if ($body.text().includes('Chưa có bài kiểm tra')) {
                cy.contains('Chưa có bài kiểm tra').should('be.visible');
            } else {
                // There should be quiz cards
                cy.contains('phút').should('be.visible'); // Quiz time indicator
            }
        });
    });

    it('should show back button on quiz list', () => {
        cy.contains('Lớp 1').click();
        cy.contains('Quay lại').should('be.visible');
        cy.contains('Quay lại').click();
        cy.contains('Lớp 1').should('be.visible');
    });

    it('should navigate to teacher login', () => {
        cy.contains('Dành cho Giáo viên').click();
        cy.contains('Tên đăng nhập').should('be.visible');
        cy.contains('Mật khẩu').should('be.visible');
    });
});

describe('Teacher Login Flow', () => {
    beforeEach(() => {
        cy.visit('/');
    });

    it('should login with admin credentials', () => {
        cy.contains('Dành cho Giáo viên').click();
        
        // Fill login form
        cy.get('input[type="text"]').first().type('admin');
        cy.get('input[type="password"]').type('admin');
        cy.contains('Đăng nhập').click();
        
        // Should be on teacher dashboard
        cy.contains('Đăng xuất').should('be.visible');
    });

    it('should show error for invalid credentials', () => {
        cy.contains('Dành cho Giáo viên').click();

        cy.get('input[type="text"]').first().type('wronguser');
        cy.get('input[type="password"]').type('wrongpass');
        cy.contains('Đăng nhập').click();

        // Should show error
        cy.contains('Tên đăng nhập hoặc mật khẩu không đúng').should('be.visible');
    });

    it('should logout successfully', () => {
        // Login first
        cy.contains('Dành cho Giáo viên').click();
        cy.get('input[type="text"]').first().type('admin');
        cy.get('input[type="password"]').type('admin');
        cy.contains('Đăng nhập').click();

        // Then logout
        cy.contains('Đăng xuất').click();

        // Should be back home
        cy.contains('Lớp 1').should('be.visible');
    });
});
