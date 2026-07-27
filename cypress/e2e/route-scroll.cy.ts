/**
 * Reset vị trí cuộn ở tầng router, đo trên các trang công khai nên KHÔNG cần backend hay tài khoản
 * — chạy được trong nhóm stubbed ở CI, khác với hai spec học sinh phải đăng nhập thật.
 *
 * ĐỌC KỸ TRƯỚC KHI SỬA: không phải điều hướng nào cũng bắt được lỗi này. Đo trên dev server khi
 * gỡ hẳn phần reset cuộn ra khỏi app:
 *
 * | điều hướng                             | scrollY khi KHÔNG có bản sửa | bắt được lỗi? |
 * |----------------------------------------|------------------------------|---------------|
 * | `/` → `/about`                         | 0                            | KHÔNG         |
 * | `/about` → `/contact`                  | 1466                         | CÓ            |
 * | Back về `/`                            | khôi phục đúng               | KHÔNG         |
 * | `/privacy` → `/` bằng nút "Quay lại"   | 0 (đáng lẽ 448)              | CÓ            |
 *
 * Dòng cuối đo ở mốc khác ba dòng trên: giữ nguyên `useScrollReset`, chỉ trả
 * `AppRoutes.goBackHome` về `navigate('/')`. Đó là PUSH nên hook đẩy người đọc lên đầu trang chủ,
 * mất luôn chỗ footer họ vừa rời đi.
 *
 * `/` → `/about` tự về 0 vì `<PageLoading/>` của route lazy làm document co lại còn một màn hình
 * (đo được `scrollHeight` 2370 → 812) và trình duyệt kẹp `scrollY` về 0 — không liên quan gì đến
 * bản sửa. Back cũng tự đúng vì `history.scrollRestoration` mặc định là `auto`. Chỉ bước
 * lazy → lazy mới giữ nguyên vị trí cuộn và lộ ra lỗi. Đừng "đơn giản hoá" spec này về một bước
 * điều hướng khác mà không đo lại: rất dễ thành test luôn xanh mà chẳng kiểm gì.
 */

const DESKTOP = { width: 1280, height: 720 } as const;

/**
 * Click footer links without Cypress auto-scrolling them again. Each test has already brought the
 * footer into view, so another synthetic scroll would change the offset immediately before the
 * navigation and make the assertion observe Cypress behavior instead of reader behavior.
 */
const clickFooterLink = (label: string) => cy.get('footer button').contains(label).click({ scrollBehavior: false });

const visitScrolledToBottom = (path: string) => {
  cy.viewport(DESKTOP.width, DESKTOP.height);
  cy.visit(path);
  cy.get('h1').first().should('be.visible');
  cy.scrollTo('bottom');
  cy.window().its('scrollY').should('be.greaterThan', 0);
};

describe('Scroll position across client-side navigation', () => {
  // Đây là test có sức phân biệt: không có bản sửa thì trang Liên hệ mở ra ở scrollY 1466.
  it('opens the next lazy page at the top instead of inheriting the previous offset', () => {
    visitScrolledToBottom('/about');

    clickFooterLink('Liên hệ');

    cy.location('pathname').should('equal', '/contact');
    cy.window().its('scrollY').should('equal', 0);
    cy.get('h1').first().should('be.visible');
  });

  // Hai test dưới KHÔNG phân biệt được (xem bảng ở đầu file) — giữ lại làm chốt chặn hồi quy cho
  // hành vi Back, thứ dễ hỏng nhất khi ai đó đụng vào cơ chế cuộn.
  it('still lands at the top on the first hop out of the landing page', () => {
    visitScrolledToBottom('/');

    clickFooterLink('Giới thiệu');

    cy.location('pathname').should('equal', '/about');
    cy.window().its('scrollY').should('equal', 0);
  });

  // Test phân biệt thứ hai: nút của trang pháp lý từng là `navigate('/')`, một PUSH, nên bản hỏng
  // trả người đọc về scrollY 0 thay vì chỗ footer họ vừa rời đi.
  it('returns the reader to the footer they left when the legal page hands them back', () => {
    visitScrolledToBottom('/');

    cy.window().then((win) => win.scrollY).then((offsetBeforeLeaving) => {
      clickFooterLink('Chính sách bảo mật');
      cy.location('pathname').should('equal', '/privacy');

      // Nút này nằm cuối trang; `cy.click()` tự cuộn nó vào tầm nhìn, không ảnh hưởng gì vì ta đang rời trang.
      cy.contains('button', 'Quay lại Trang chủ').click();

      cy.location('pathname').should('equal', '/');
      cy.window().should((win) => {
        expect(win.scrollY, 'vị trí cuộn sau khi bấm Quay lại Trang chủ').to.be.closeTo(offsetBeforeLeaving, 100);
      });
    });
  });

  it('returns to the offset the previous page was left at on browser Back', () => {
    cy.viewport(DESKTOP.width, DESKTOP.height);
    cy.visit('/');
    cy.get('h1').first().should('be.visible');
    cy.scrollTo('bottom');

    cy.window().then((win) => win.scrollY).then((offsetBeforeLeaving) => {
      expect(offsetBeforeLeaving, 'trang chủ đã cuộn trước khi điều hướng').to.be.greaterThan(0);

      clickFooterLink('Giới thiệu');
      cy.location('pathname').should('equal', '/about');
      cy.window().its('scrollY').should('equal', 0);

      cy.go('back');
      cy.location('pathname').should('equal', '/');
      // Khôi phục là bất đồng bộ (chờ document cao lại), nên dùng should + callback để thử lại.
      cy.window().should((win) => {
        expect(win.scrollY, 'vị trí cuộn sau khi bấm Back').to.be.closeTo(offsetBeforeLeaving, 100);
      });
    });
  });
});
