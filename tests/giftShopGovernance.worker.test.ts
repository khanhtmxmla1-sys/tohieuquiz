// @vitest-environment node
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const migrationPath = 'workers/migrations/0049_gift_shop_governance.sql';

const legacySchema = `
  PRAGMA foreign_keys = ON;
  CREATE TABLE teachers (username TEXT PRIMARY KEY);
  CREATE TABLE classes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    teacher_username TEXT NOT NULL,
    created_at TEXT NOT NULL,
    archived_at TEXT
  );
  CREATE TABLE students (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    username TEXT NOT NULL,
    class_id TEXT NOT NULL,
    coins INTEGER NOT NULL DEFAULT 0,
    archived_at TEXT
  );
  CREATE TABLE gift_catalog_items (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    price_coins INTEGER NOT NULL,
    image_url TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE gift_orders (
    id TEXT PRIMARY KEY,
    idempotency_key TEXT UNIQUE NOT NULL,
    student_id TEXT NOT NULL,
    class_id TEXT NOT NULL,
    item_snapshot TEXT NOT NULL,
    price_coins INTEGER NOT NULL,
    status TEXT NOT NULL,
    voucher_code TEXT NOT NULL,
    delivered_by TEXT DEFAULT '',
    delivered_at TEXT DEFAULT '',
    cancel_reason TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE gift_vouchers (
    code TEXT PRIMARY KEY,
    order_id TEXT UNIQUE NOT NULL,
    student_id TEXT NOT NULL,
    issued_at TEXT NOT NULL,
    status TEXT NOT NULL
  );
  CREATE TABLE gift_wallet_ledger (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    delta_coins INTEGER NOT NULL,
    reason TEXT NOT NULL,
    ref_order_id TEXT DEFAULT '',
    created_at TEXT NOT NULL
  );
  CREATE TABLE gift_order_events (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    order_id TEXT DEFAULT '',
    student_id TEXT DEFAULT '',
    actor TEXT DEFAULT '',
    metadata TEXT DEFAULT '{}',
    created_at TEXT NOT NULL
  );
`;

const now = '2026-07-29T01:00:00.000Z';

const insertPendingOrder = (
  db: DatabaseSync,
  input: { id: string; key: string; studentId?: string; itemId?: string; weekKey?: string; priceCoins?: number },
) => {
  const priceCoins = input.priceCoins ?? 60;
  return db.prepare(`
  INSERT INTO gift_orders (
    id, idempotency_key, student_id, class_id, item_id, school_id, grade_level,
    week_key, item_snapshot, price_coins, status, voucher_code,
    transition_actor, transition_request_id, created_at, updated_at
  ) VALUES (?, ?, ?, 'class-3a', ?, 'school-a', 3, ?, ?, ?, 'PENDING', '', ?, ?, ?, ?)
`).run(
  input.id,
  input.key,
  input.studentId || 'student-1',
  input.itemId || 'gift-1',
  input.weekKey || '2026-W31',
  JSON.stringify({ id: input.itemId || 'gift-1', name: 'Bút chì', priceCoins }),
  priceCoins,
  input.studentId || 'student-1',
  `request-${input.id}`,
  now,
  now,
  );
};

let db: DatabaseSync;

beforeEach(() => {
  db = new DatabaseSync(':memory:');
  db.exec(legacySchema);
  db.exec(readFileSync(migrationPath, 'utf8'));
  db.exec(`
    INSERT INTO teachers VALUES ('school-a'), ('school-b');
    INSERT INTO classes VALUES
      ('class-3a', '3A', 'school-a', '${now}', NULL),
      ('class-4b', '4B', 'school-b', '${now}', NULL);
    INSERT INTO students VALUES
      ('student-1', 'Nguyễn An', 'an3a', 'class-3a', 100, NULL),
      ('student-2', 'Trần Bình', 'binh4b', 'class-4b', 100, NULL);
    INSERT INTO gift_catalog_items (
      id, name, category, price_coins, image_url, is_active, created_at, updated_at,
      stock_total, stock_remaining, low_stock_threshold, weekly_limit_per_student,
      scope_type, school_id, class_id, grade_level, created_by
    ) VALUES
      ('gift-1', 'Bút chì', 'SUPPLY', 60, 'https://cdn.test/pencil.png', 1, '${now}', '${now}',
       1, 1, 1, 1, 'SCHOOL', 'school-a', NULL, NULL, 'admin'),
      ('gift-grade-3', 'Huy hiệu lớp 3', 'PRIVILEGE', 20, 'https://cdn.test/badge.png', 1, '${now}', '${now}',
       5, 5, 1, 2, 'GRADE', 'school-a', NULL, 3, 'admin');
  `);
});

afterEach(() => db.close());

describe('Gift Shop governance migration', () => {
  it('prevents stock or coins from going negative when the last item is purchased twice', () => {
    insertPendingOrder(db, { id: 'order-1', key: 'idem-1' });
    expect(() => insertPendingOrder(db, { id: 'order-2', key: 'idem-2' }))
      .toThrow(/GIFT_OUT_OF_STOCK/);

    expect(db.prepare("SELECT coins FROM students WHERE id='student-1'").get()).toEqual({ coins: 40 });
    expect(db.prepare("SELECT stock_remaining FROM gift_catalog_items WHERE id='gift-1'").get())
      .toEqual({ stock_remaining: 0 });
    expect(db.prepare("SELECT COUNT(*) AS count FROM gift_orders").get()).toEqual({ count: 1 });
  });

  it('enforces the weekly per-student limit before changing stock or coins', () => {
    insertPendingOrder(db, { id: 'order-1', key: 'idem-1', itemId: 'gift-grade-3', priceCoins: 20 });
    insertPendingOrder(db, { id: 'order-2', key: 'idem-2', itemId: 'gift-grade-3', priceCoins: 20 });
    expect(() => insertPendingOrder(db, { id: 'order-3', key: 'idem-3', itemId: 'gift-grade-3', priceCoins: 20 }))
      .toThrow(/GIFT_WEEKLY_LIMIT/);

    expect(db.prepare("SELECT coins FROM students WHERE id='student-1'").get()).toEqual({ coins: 60 });
    expect(db.prepare("SELECT stock_remaining FROM gift_catalog_items WHERE id='gift-grade-3'").get())
      .toEqual({ stock_remaining: 3 });
  });

  it('blocks purchases when either the school or class shop is closed', () => {
    db.prepare(`
      INSERT INTO gift_shop_scope_settings
      (id, scope_type, school_id, class_id, is_open, closed_reason, updated_by, updated_at)
      VALUES ('setting-school-a', 'SCHOOL', 'school-a', '', 0, 'Kiểm kê kho', 'admin', ?)
    `).run(now);

    expect(() => insertPendingOrder(db, { id: 'order-closed', key: 'idem-closed' }))
      .toThrow(/GIFT_SHOP_CLOSED/);
    expect(db.prepare("SELECT coins FROM students WHERE id='student-1'").get()).toEqual({ coins: 100 });
  });

  it('rejects invalid state transitions with a database conflict code', () => {
    insertPendingOrder(db, { id: 'order-1', key: 'idem-1' });
    expect(() => db.prepare(`
      UPDATE gift_orders
      SET status='DELIVERED', transition_actor='teacher-a', transition_request_id='request-deliver', updated_at=?
      WHERE id='order-1'
    `).run(now)).toThrow(/GIFT_INVALID_TRANSITION/);
  });

  it('refunds coins and restores stock exactly once when cancellation is replayed', () => {
    insertPendingOrder(db, { id: 'order-1', key: 'idem-1' });
    const cancel = db.prepare(`
      UPDATE gift_orders
      SET status='CANCELLED', cancel_reason='Học sinh đổi ý', cancelled_by='teacher-a', cancelled_at=?,
          transition_actor='teacher-a', transition_request_id='request-cancel', updated_at=?
      WHERE id='order-1' AND status IN ('PENDING', 'APPROVED')
    `);
    cancel.run(now, now);
    cancel.run(now, now);

    expect(db.prepare("SELECT coins FROM students WHERE id='student-1'").get()).toEqual({ coins: 100 });
    expect(db.prepare("SELECT stock_remaining FROM gift_catalog_items WHERE id='gift-1'").get())
      .toEqual({ stock_remaining: 1 });
    expect(db.prepare("SELECT COUNT(*) AS count FROM gift_wallet_ledger WHERE reason='REFUND'").get())
      .toEqual({ count: 1 });
    expect(db.prepare("SELECT COUNT(*) AS count FROM gift_order_events WHERE event_type='WALLET_REFUNDED'").get())
      .toEqual({ count: 1 });
  });
});
