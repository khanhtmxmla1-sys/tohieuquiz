/// <reference types="cypress" />

/**
 * Gift Shop V2 — luồng đầy đủ: học sinh đổi quà, giáo viên trao hoặc hủy và hoàn xu.
 *
 * Vì sao stub `cy.intercept` chứ không đăng nhập thật: `VITE_GIFT_SHOP_MODE=api` ở cả CI lẫn
 * production, nên đường chạy thật đi qua HTTP tới `/api/gift-shop/*`. Stub ở tầng HTTP giữ nguyên
 * đường đó — vẫn là `giftShopService` → `apiAdapter` → `fetch` thật — nên spec khoá được **hình
 * dạng request/response** mà unit test không chạm tới, và vẫn chạy được trong nhóm stubbed ở CI
 * (không cần backend, không cần tài khoản).
 *
 * Hai điểm dễ sai khi sửa file này:
 *
 * 1. **Bao thư của response khác nhau giữa hai nhóm endpoint.** `/api/student-profile` đi qua
 *    `callWorkerApi` nên phải trả `{ status: 'success', data }`; còn `/api/gift-shop/*` đi thẳng
 *    `executeApiAction`, hàm này `return response.json()` nguyên vẹn — trả thêm bao thư là hỏng.
 *
 * 2. **Dashboard học sinh không cần dữ liệu để hiện nút vào tiệm.** `RewardSidebar` render nút
 *    "Xem mục tiêu quà tặng" ngay cả khi `dashboard` là null, nên spec không phải stub toàn bộ bề
 *    mặt API của dashboard (điểm danh, nhiệm vụ, huy hiệu…). Đừng thêm stub cho những thứ đó nếu
 *    không có assert đi kèm.
 *
 * Giáo viên vào bằng `?autologin=teacher` (`useTeacherEntry`) — đọc `window.location.search` trong
 * app thật, không phải cửa hậu riêng cho test.
 *
 * ĐÃ ĐO SỨC PHÂN BIỆT (spec stub rất dễ thành test chỉ kiểm chính cái stub của mình):
 *
 * | phá thứ gì                                            | kết quả       |
 * |-------------------------------------------------------|---------------|
 * | `VITE_FEATURE_GIFT_SHOP_V2=false`                     | 3/3 đỏ        |
 * | bỏ `idempotencyKey` khỏi payload trong `apiGiftShop`  | test 1 đỏ     |
 *
 * Chạy tại máy (cờ phải bật, dev server không tự bật hộ):
 *   VITE_FEATURE_GIFT_SHOP_V2=true npm run dev
 *   npx cypress run --e2e --spec "cypress/e2e/gift-shop.cy.ts"
 */

const teacherAuthStorageValue = JSON.stringify({
  state: {
    isLoggedIn: true,
    username: 'admin',
    teacherName: 'Quản trị Gift Shop',
    isAdmin: true,
    teacherClass: null,
  },
  version: 0,
});

const student = {
  studentId: 'student-an',
  fullName: 'Nguyễn Văn An',
  username: 'hs.an',
  classId: 'class-4a9',
  className: '4A9',
  avatar: '',
  coins: 500,
  pet: null,
  shopItems: [],
};

const timestamps = { createdAt: '2026-07-25T01:00:00.000Z', updatedAt: '2026-07-25T01:00:00.000Z' };

const BISCUIT = { id: 'gift-banh', name: 'Bánh quy bơ', category: 'SNACK', priceCoins: 200, imageUrl: '', isActive: true, stockTotal: 10, stockRemaining: 10, lowStockThreshold: 2, weeklyLimitPerStudent: 1, scopeType: 'SCHOOL', schoolId: 'admin', ...timestamps };
const PEN = { id: 'gift-but', name: 'Bút bi bốn màu', category: 'SUPPLY', priceCoins: 300, imageUrl: '', isActive: true, stockTotal: 10, stockRemaining: 10, lowStockThreshold: 2, weeklyLimitPerStudent: 1, scopeType: 'SCHOOL', schoolId: 'admin', ...timestamps };
// Đắt hơn số xu đang có (500) nên là mốc của thanh "cần thêm bao nhiêu xu".
const MONITOR = { id: 'gift-lop-truong', name: 'Làm lớp trưởng một ngày', category: 'PRIVILEGE', priceCoins: 900, imageUrl: '', isActive: true, stockTotal: 10, stockRemaining: 10, lowStockThreshold: 2, weeklyLimitPerStudent: 1, scopeType: 'SCHOOL', schoolId: 'admin', ...timestamps };
// isActive false: học sinh không được thấy, dù cùng danh mục và thừa xu để đổi.
const RETIRED = { id: 'gift-keo', name: 'Kẹo mút ngừng bán', category: 'SNACK', priceCoins: 50, imageUrl: '', isActive: false, stockTotal: 10, stockRemaining: 10, lowStockThreshold: 2, weeklyLimitPerStudent: 1, scopeType: 'SCHOOL', schoolId: 'admin', ...timestamps };

const CATALOG = [BISCUIT, PEN, MONITOR, RETIRED];

const pendingOrder = {
  id: 'order-an-1',
  studentId: student.studentId,
  studentName: student.fullName,
  studentUsername: student.username,
  classId: student.classId,
  className: student.className,
  itemSnapshot: BISCUIT,
  priceCoins: BISCUIT.priceCoins,
  status: 'PENDING',
  voucherCode: '',
  createdAt: '2026-07-25T02:00:00.000Z',
  updatedAt: '2026-07-25T02:00:00.000Z',
};

/**
 * @param seedOrders đơn đã có sẵn trước khi spec bắt đầu (phía giáo viên cần, phía học sinh không).
 */
function installGiftShopApi(seedOrders: Array<typeof pendingOrder> = [], accountMode: 'student' | 'admin' = 'admin') {
  // Copy từng đơn chứ không chỉ copy mảng: handler trao/hủy sửa `status` ngay trên object, nên
  // `[...seedOrders]` sẽ để test trước làm bẩn `pendingOrder` cho test sau (đơn "chờ trao" biến mất).
  const orders = seedOrders.map((order) => ({ ...order }));

  cy.intercept('GET', '**/api/system-settings*', { status: 'success', data: { aiAssistantEnabled: false } });
  cy.intercept('GET', '**/api/account/me', accountMode === 'student'
    ? {
      statusCode: 401,
      body: { status: 'error', message: 'Unauthorized' },
    }
    : {
      statusCode: 200,
      body: {
        data: {
          username: 'admin',
          fullName: 'Qu?n tr? Gift Shop',
          role: 'admin',
          classes: [],
          mustChangePassword: false,
        },
      },
    }).as('teacherSession');
  cy.intercept('GET', '**/api/student-profile', { status: 'success', data: student }).as('studentProfile');

  cy.intercept('GET', '**/api/gift-shop/catalog', CATALOG).as('giftCatalog');
  cy.intercept('GET', '**/api/gift-shop/events', []).as('giftEvents');
  let shopSetting = {
    effective: { isOpen: true, closedReason: '', closedScope: null, schoolId: 'admin', classId: student.classId },
    settings: [],
  };
  cy.intercept('GET', '**/api/gift-shop/settings', (req) => req.reply(shopSetting)).as('giftSettings');
  cy.intercept('PUT', '**/api/gift-shop/settings', (req) => {
    shopSetting = {
      effective: {
        isOpen: Boolean(req.body.isOpen),
        closedReason: req.body.isOpen ? '' : String(req.body.closedReason || ''),
        closedScope: req.body.isOpen ? null : req.body.scopeType,
        schoolId: String(req.body.schoolId || 'admin'),
        classId: String(req.body.classId || student.classId),
      },
      settings: [],
    };
    req.reply(shopSetting);
  }).as('giftSettingsUpdate');

  // Một handler cho cả hai phía: có studentId là học sinh xem đơn của mình, còn lại là hàng đợi của
  // giáo viên và phải tôn trọng bộ lọc trạng thái — đó là thứ làm đơn biến mất khỏi hàng đợi sau khi trao.
  cy.intercept('GET', '**/api/gift-shop/orders*', (req) => {
    const status = req.query.status;
    const studentId = req.query.studentId;
    const matched = orders.filter((order) => (
      (!studentId || order.studentId === studentId)
      && (!status || status === 'ALL' || order.status === status)
    ));
    req.reply({
      data: matched,
      meta: { nextCursor: null, hasMore: false },
    });
  }).as('giftOrders');

  cy.intercept('POST', '**/api/gift-shop/purchase', (req) => {
    const item = CATALOG.find((entry) => entry.id === req.body.itemId)!;
    const order = {
      ...pendingOrder,
      itemSnapshot: item,
      priceCoins: item.priceCoins,
      status: 'PENDING',
    };
    orders.push(order);
    req.reply({
      orderId: order.id,
      voucherCode: '',
      newCoins: student.coins - item.priceCoins,
      status: order.status,
      idempotencyReplay: false,
      order,
    });
  }).as('giftPurchase');

  cy.intercept('PATCH', '**/api/gift-shop/orders/*/approve', (req) => {
    const orderId = req.url.split('/orders/')[1].split('/')[0];
    const order = orders.find((entry) => entry.id === orderId)!;
    order.status = 'APPROVED';
    order.voucherCode = 'QUA-7HK2';
    req.reply(order);
  }).as('giftApprove');

  cy.intercept('PATCH', '**/api/gift-shop/orders/*/deliver', (req) => {
    const orderId = req.url.split('/orders/')[1].split('/')[0];
    const order = orders.find((entry) => entry.id === orderId)!;
    order.status = 'DELIVERED';
    req.reply(order);
  }).as('giftDeliver');

  cy.intercept('PATCH', '**/api/gift-shop/orders/*/cancel', (req) => {
    const orderId = req.url.split('/orders/')[1].split('/')[0];
    const order = orders.find((entry) => entry.id === orderId)!;
    order.status = 'CANCELLED';
    order.cancelReason = req.body.reason;
    req.reply({ order, newCoins: student.coins, refundedCoins: order.priceCoins, idempotencyReplay: false });
  }).as('giftCancel');

  return { orders };
}

const visitAsStudent = () => {
  cy.viewport(1440, 900);
  cy.visit('/student/dashboard', {
    onBeforeLoad(win) {
      win.localStorage.setItem('tohieuquiz_student_restore_hint', '1');
    },
  });
  cy.wait('@studentProfile');
  cy.location('pathname').should('eq', '/student/dashboard');
};

const openGiftShopAsStudent = () => {
  // `@studentProfile` chỉ xác nhận API đã trả về; React vẫn có thể đang commit dashboard
  // trong lần chạy CI lạnh. Chờ đúng điều kiện người dùng có thể thao tác thay vì sleep.
  cy.contains('button', 'Xem mục tiêu quà tặng', { timeout: 10_000 })
    .should('be.visible')
    .click();
  cy.contains('h1', 'Tiệm tạp hóa').should('be.visible');
};

const openGiftShopAsTeacher = () => {
  cy.viewport(1440, 900);
  cy.visit('/teacher/gift-shop?status=PENDING', {
    onBeforeLoad(win) {
      win.localStorage.setItem('auth-storage', teacherAuthStorageValue);
    },
  });
  cy.wait('@teacherSession');
  cy.location('pathname').should('eq', '/teacher/gift-shop');
  cy.wait('@giftOrders');
  cy.contains('h2', 'Tiệm tạp hóa', { timeout: 20_000 }).should('be.visible');
};

/** Đổi bộ lọc trạng thái làm `query.status` đổi theo, `useGiftShopRefresh` tải lại danh sách. */
const filterOrdersBy = (label: string) => {
  cy.contains('button', label).click();
  cy.wait('@giftOrders');
};

describe('Gift Shop V2 end-to-end contracts', () => {
  it('lets a student spend coins and submit a pending request without an early voucher', () => {
    installGiftShopApi([], 'student');
    visitAsStudent();
    openGiftShopAsStudent();
    cy.wait('@giftCatalog');

    cy.get('header').contains('500 xu').should('be.visible');
    cy.contains('Cần thêm 400 xu để đổi Làm lớp trưởng một ngày').should('be.visible');
    cy.contains('Bánh quy bơ').should('be.visible');
    cy.contains('Kẹo mút ngừng bán').should('not.exist');

    cy.contains('article', 'Bánh quy bơ').contains('button', 'Đổi quà').click();
    cy.get('[role="dialog"]').contains('button', 'Xác nhận đổi quà').click();

    cy.wait('@giftPurchase').its('request.body').should((body) => {
      expect(body.itemId, 'itemId').to.equal('gift-banh');
      expect(body.studentId, 'studentId').to.equal('student-an');
      expect(body.currentCoins, 'số xu gửi lên để server đối chiếu').to.equal(500);
      // Khoá chống mua trùng khi bấm lại: thiếu nó là server không chặn được đơn lặp.
      expect(body.idempotencyKey, 'idempotencyKey').to.be.a('string').and.not.be.empty;
    });

    cy.contains('Đổi quà thành công').should('be.visible');
    cy.contains('Trạng thái: Chờ giáo viên duyệt').should('be.visible');

    cy.contains('button', 'Xem đơn của em').click();
    cy.get('header').contains('300 xu').should('be.visible');
    // Đơn mới chưa có voucher. Giới hạn kiểm tra trong khu vực đơn để không bắt nhầm thẻ catalog cùng tên món.
    cy.contains('section', 'Đơn đổi quà của em').within(() => {
      cy.contains('article', 'Bánh quy bơ').should('contain.text', 'Chờ giáo viên duyệt');
      cy.contains('QUA-').should('not.exist');
    });
  });

  it('approves a pending order before delivering it', () => {
    installGiftShopApi([pendingOrder]);
    openGiftShopAsTeacher();

    cy.contains('article', 'Chờ duyệt').should('contain.text', '1');
    cy.contains('article', 'Nguyễn Văn An').within(() => {
      cy.contains('Cấp sau khi duyệt').should('be.visible');
      cy.contains('Bánh quy bơ').should('be.visible');
      cy.contains('button', 'Duyệt đơn').click();
    });

    cy.wait('@giftApprove').its('request.body').should((body) => {
      expect(body.username, 'giáo viên duyệt').to.equal('admin');
      expect(body.isAdmin).to.equal(true);
    });
    cy.contains('Chưa có đơn phù hợp').should('be.visible');

    filterOrdersBy('Chờ trao');
    cy.contains('article', 'Nguyễn Văn An').within(() => {
      cy.contains('QUA-7HK2').should('be.visible');
      cy.contains('button', 'Xác nhận đã trao').click();
    });

    cy.get('[role="dialog"]').within(() => {
      cy.contains('Đã trao quà?').should('be.visible');
      cy.contains('QUA-7HK2').should('be.visible');
      cy.contains('button', 'Xác nhận đã trao').click();
    });

    cy.wait('@giftDeliver').its('request.body').should((body) => {
      expect(body.username, 'giáo viên thao tác').to.equal('admin');
      expect(body.isAdmin).to.equal(true);
    });

    cy.contains('Chưa có đơn phù hợp').should('be.visible');
    filterOrdersBy('Đã trao');
    cy.contains('article', 'QUA-7HK2').within(() => {
      cy.contains('Đã trao quà').should('be.visible');
      cy.contains('button', 'Xác nhận đã trao').should('not.exist');
    });
  });

  it('lets a teacher close the current shop scope with a reason', () => {
    installGiftShopApi();
    openGiftShopAsTeacher();

    cy.contains('button', 'Tạm đóng tiệm').should('be.disabled');
    cy.get('input[placeholder="Ví dụ: Đang kiểm kê phần thưởng"]').type('Đang kiểm kê kho quà');
    cy.contains('button', 'Tạm đóng tiệm').click();

    cy.wait('@giftSettingsUpdate').its('request.body').should((body) => {
      expect(body.scopeType).to.equal('SCHOOL');
      expect(body.isOpen).to.equal(false);
      expect(body.closedReason).to.equal('Đang kiểm kê kho quà');
    });
    cy.contains('Tiệm đang tạm đóng').should('be.visible');
  });

  it('refuses to cancel an order without a reason, then refunds with one', () => {
    installGiftShopApi([pendingOrder]);
    openGiftShopAsTeacher();

    cy.contains('article', 'Nguyễn Văn An').contains('button', 'Hủy và hoàn xu').click();

    cy.get('[role="dialog"]').within(() => {
      cy.contains('Học sinh sẽ được hoàn 100% (200 xu).').should('be.visible');
      cy.contains('button', 'Hủy đơn và hoàn xu').should('be.disabled');
      cy.get('textarea').type('Hết hàng, đã đổi sang phần thưởng khác.');
      cy.contains('button', 'Hủy đơn và hoàn xu').should('not.be.disabled').click();
    });

    cy.wait('@giftCancel').its('request.body').should((body) => {
      expect(body.reason, 'lý do hủy phải đi kèm request').to.equal('Hết hàng, đã đổi sang phần thưởng khác.');
      expect(body.username).to.equal('admin');
    });

    cy.contains('Chưa có đơn phù hợp').should('be.visible');

    filterOrdersBy('Đã hủy');
    cy.contains('article', 'Nguyễn Văn An').should('contain.text', 'Đã hủy và hoàn xu');
    cy.contains('article', 'Đã hoàn xu').should('contain.text', '1');
  });
});
