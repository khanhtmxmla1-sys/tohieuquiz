-- Gift Shop governance: scoped catalog, stock/weekly limits, strict transitions and idempotent refunds.

ALTER TABLE gift_catalog_items ADD COLUMN stock_total INTEGER NOT NULL DEFAULT 100;
ALTER TABLE gift_catalog_items ADD COLUMN stock_remaining INTEGER NOT NULL DEFAULT 100;
ALTER TABLE gift_catalog_items ADD COLUMN low_stock_threshold INTEGER NOT NULL DEFAULT 5;
ALTER TABLE gift_catalog_items ADD COLUMN weekly_limit_per_student INTEGER NOT NULL DEFAULT 1;
ALTER TABLE gift_catalog_items ADD COLUMN scope_type TEXT NOT NULL DEFAULT 'SCHOOL';
ALTER TABLE gift_catalog_items ADD COLUMN school_id TEXT NOT NULL DEFAULT '';
ALTER TABLE gift_catalog_items ADD COLUMN class_id TEXT;
ALTER TABLE gift_catalog_items ADD COLUMN grade_level INTEGER;
ALTER TABLE gift_catalog_items ADD COLUMN created_by TEXT NOT NULL DEFAULT '';

ALTER TABLE gift_orders ADD COLUMN item_id TEXT NOT NULL DEFAULT '';
ALTER TABLE gift_orders ADD COLUMN school_id TEXT NOT NULL DEFAULT '';
ALTER TABLE gift_orders ADD COLUMN grade_level INTEGER;
ALTER TABLE gift_orders ADD COLUMN week_key TEXT NOT NULL DEFAULT '';
ALTER TABLE gift_orders ADD COLUMN approved_by TEXT NOT NULL DEFAULT '';
ALTER TABLE gift_orders ADD COLUMN approved_at TEXT NOT NULL DEFAULT '';
ALTER TABLE gift_orders ADD COLUMN cancelled_by TEXT NOT NULL DEFAULT '';
ALTER TABLE gift_orders ADD COLUMN cancelled_at TEXT NOT NULL DEFAULT '';
ALTER TABLE gift_orders ADD COLUMN transition_actor TEXT NOT NULL DEFAULT '';
ALTER TABLE gift_orders ADD COLUMN transition_request_id TEXT NOT NULL DEFAULT '';
ALTER TABLE gift_order_events ADD COLUMN request_id TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS gift_shop_scope_settings (
  id TEXT PRIMARY KEY,
  scope_type TEXT NOT NULL CHECK(scope_type IN ('SCHOOL', 'CLASS')),
  school_id TEXT NOT NULL,
  class_id TEXT NOT NULL DEFAULT '',
  is_open INTEGER NOT NULL DEFAULT 1 CHECK(is_open IN (0, 1)),
  closed_reason TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(scope_type, school_id, class_id)
);

UPDATE gift_catalog_items
SET stock_total = MAX(0, stock_total),
    stock_remaining = MIN(MAX(0, stock_remaining), MAX(0, stock_total)),
    low_stock_threshold = MAX(0, low_stock_threshold),
    weekly_limit_per_student = MAX(0, weekly_limit_per_student),
    scope_type = CASE WHEN scope_type IN ('SCHOOL', 'GRADE', 'CLASS') THEN scope_type ELSE 'SCHOOL' END;

UPDATE gift_orders
SET item_id = CASE
      WHEN item_id <> '' THEN item_id
      WHEN json_valid(item_snapshot) = 1 THEN COALESCE(json_extract(item_snapshot, '$.id'), '')
      ELSE ''
    END,
    school_id = COALESCE((SELECT teacher_username FROM classes WHERE classes.id = gift_orders.class_id), ''),
    grade_level = CAST(substr(COALESCE((SELECT name FROM classes WHERE classes.id = gift_orders.class_id), ''), 1, 1) AS INTEGER),
    week_key = CASE
      WHEN week_key <> '' THEN week_key
      ELSE strftime('%Y-W%W', created_at)
    END,
    status = CASE status
      WHEN 'CREATED' THEN 'PENDING'
      WHEN 'VOUCHER_ISSUED' THEN 'APPROVED'
      WHEN 'CANCELLED_REFUNDED' THEN 'CANCELLED'
      ELSE status
    END;

CREATE INDEX IF NOT EXISTS idx_gift_catalog_scope_stock
  ON gift_catalog_items(is_active, school_id, scope_type, class_id, grade_level, stock_remaining);
CREATE INDEX IF NOT EXISTS idx_gift_orders_student_item_week
  ON gift_orders(student_id, item_id, week_key, status);
CREATE INDEX IF NOT EXISTS idx_gift_scope_settings_lookup
  ON gift_shop_scope_settings(school_id, class_id, is_open);
CREATE INDEX IF NOT EXISTS idx_gift_events_request
  ON gift_order_events(request_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_gift_order_purchase_guard;
CREATE TRIGGER trg_gift_order_purchase_guard
BEFORE INSERT ON gift_orders
WHEN NEW.status = 'PENDING'
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM gift_catalog_items item
    WHERE item.id = NEW.item_id AND item.is_active = 1
  ) THEN RAISE(ABORT, 'GIFT_ITEM_UNAVAILABLE') END;

  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM students student
    WHERE student.id = NEW.student_id
      AND student.class_id = NEW.class_id
      AND COALESCE(student.archived_at, '') = ''
  ) THEN RAISE(ABORT, 'GIFT_STUDENT_SCOPE') END;

  SELECT CASE WHEN NOT EXISTS (
    SELECT 1
    FROM gift_catalog_items item
    JOIN students student ON student.id = NEW.student_id AND student.class_id = NEW.class_id
    JOIN classes classroom ON classroom.id = student.class_id AND COALESCE(classroom.archived_at, '') = ''
    WHERE item.id = NEW.item_id
      AND (item.school_id = '' OR item.school_id = classroom.teacher_username)
      AND (
        item.scope_type = 'SCHOOL'
        OR (item.scope_type = 'CLASS' AND COALESCE(item.class_id, '') = student.class_id)
        OR (item.scope_type = 'GRADE' AND item.grade_level = CAST(substr(classroom.name, 1, 1) AS INTEGER))
      )
  ) THEN RAISE(ABORT, 'GIFT_SCOPE_FORBIDDEN') END;

  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM gift_shop_scope_settings setting
    WHERE setting.is_open = 0
      AND setting.school_id = NEW.school_id
      AND (
        setting.scope_type = 'SCHOOL'
        OR (setting.scope_type = 'CLASS' AND setting.class_id = NEW.class_id)
      )
  ) THEN RAISE(ABORT, 'GIFT_SHOP_CLOSED') END;

  SELECT CASE WHEN (
    SELECT stock_remaining FROM gift_catalog_items WHERE id = NEW.item_id
  ) <= 0 THEN RAISE(ABORT, 'GIFT_OUT_OF_STOCK') END;

  SELECT CASE WHEN NEW.price_coins <> (
    SELECT price_coins FROM gift_catalog_items WHERE id = NEW.item_id
  ) THEN RAISE(ABORT, 'GIFT_PRICE_MISMATCH') END;

  SELECT CASE WHEN (
    SELECT coins FROM students WHERE id = NEW.student_id
  ) < NEW.price_coins THEN RAISE(ABORT, 'GIFT_INSUFFICIENT_COINS') END;

  SELECT CASE WHEN (
    SELECT weekly_limit_per_student FROM gift_catalog_items WHERE id = NEW.item_id
  ) > 0 AND (
    SELECT COUNT(*)
    FROM gift_orders prior
    WHERE prior.student_id = NEW.student_id
      AND prior.item_id = NEW.item_id
      AND prior.week_key = NEW.week_key
      AND prior.status IN ('PENDING', 'APPROVED', 'DELIVERED')
  ) >= (
    SELECT weekly_limit_per_student FROM gift_catalog_items WHERE id = NEW.item_id
  ) THEN RAISE(ABORT, 'GIFT_WEEKLY_LIMIT') END;
END;

DROP TRIGGER IF EXISTS trg_gift_order_purchase_commit;
CREATE TRIGGER trg_gift_order_purchase_commit
AFTER INSERT ON gift_orders
WHEN NEW.status = 'PENDING'
BEGIN
  UPDATE students
  SET coins = coins - NEW.price_coins
  WHERE id = NEW.student_id AND coins >= NEW.price_coins;

  UPDATE gift_catalog_items
  SET stock_remaining = stock_remaining - 1,
      updated_at = NEW.updated_at
  WHERE id = NEW.item_id AND stock_remaining > 0;

  INSERT INTO gift_wallet_ledger
    (id, student_id, delta_coins, reason, ref_order_id, created_at)
  VALUES
    ('gled-' || lower(hex(randomblob(8))), NEW.student_id, -NEW.price_coins, 'PURCHASE', NEW.id, NEW.created_at);

  INSERT INTO gift_order_events
    (id, event_type, order_id, student_id, actor, metadata, created_at, request_id)
  VALUES
    ('gevo-' || lower(hex(randomblob(8))), 'ORDER_CREATED', NEW.id, NEW.student_id,
     NEW.transition_actor, json_object('itemId', NEW.item_id, 'priceCoins', NEW.price_coins),
     NEW.created_at, NEW.transition_request_id);
END;

DROP TRIGGER IF EXISTS trg_gift_order_transition_guard;
CREATE TRIGGER trg_gift_order_transition_guard
BEFORE UPDATE OF status ON gift_orders
WHEN NEW.status <> OLD.status
BEGIN
  SELECT CASE WHEN NOT (
    (OLD.status = 'PENDING' AND NEW.status IN ('APPROVED', 'CANCELLED'))
    OR (OLD.status = 'APPROVED' AND NEW.status IN ('DELIVERED', 'CANCELLED'))
  ) THEN RAISE(ABORT, 'GIFT_INVALID_TRANSITION') END;

  SELECT CASE WHEN TRIM(NEW.transition_actor) = '' OR TRIM(NEW.transition_request_id) = ''
    THEN RAISE(ABORT, 'GIFT_TRANSITION_AUDIT_REQUIRED') END;

  SELECT CASE WHEN NEW.status = 'APPROVED' AND TRIM(NEW.voucher_code) = ''
    THEN RAISE(ABORT, 'GIFT_VOUCHER_REQUIRED') END;

  SELECT CASE WHEN NEW.status = 'CANCELLED' AND TRIM(NEW.cancel_reason) = ''
    THEN RAISE(ABORT, 'GIFT_CANCEL_REASON_REQUIRED') END;
END;

DROP TRIGGER IF EXISTS trg_gift_order_approved;
CREATE TRIGGER trg_gift_order_approved
AFTER UPDATE OF status ON gift_orders
WHEN OLD.status = 'PENDING' AND NEW.status = 'APPROVED'
BEGIN
  INSERT INTO gift_vouchers (code, order_id, student_id, issued_at, status)
  VALUES (NEW.voucher_code, NEW.id, NEW.student_id, NEW.approved_at, 'ISSUED');

  INSERT INTO gift_order_events
    (id, event_type, order_id, student_id, actor, metadata, created_at, request_id)
  VALUES
    ('gevo-' || lower(hex(randomblob(8))), 'ORDER_APPROVED', NEW.id, NEW.student_id,
     NEW.transition_actor, json_object('voucherCode', NEW.voucher_code),
     NEW.approved_at, NEW.transition_request_id);
END;

DROP TRIGGER IF EXISTS trg_gift_order_delivered;
CREATE TRIGGER trg_gift_order_delivered
AFTER UPDATE OF status ON gift_orders
WHEN OLD.status = 'APPROVED' AND NEW.status = 'DELIVERED'
BEGIN
  UPDATE gift_vouchers SET status = 'USED' WHERE order_id = NEW.id;

  INSERT INTO gift_order_events
    (id, event_type, order_id, student_id, actor, metadata, created_at, request_id)
  VALUES
    ('gevo-' || lower(hex(randomblob(8))), 'ORDER_DELIVERED', NEW.id, NEW.student_id,
     NEW.transition_actor, '{}', NEW.delivered_at, NEW.transition_request_id);
END;

DROP TRIGGER IF EXISTS trg_gift_order_cancelled;
CREATE TRIGGER trg_gift_order_cancelled
AFTER UPDATE OF status ON gift_orders
WHEN OLD.status IN ('PENDING', 'APPROVED') AND NEW.status = 'CANCELLED'
BEGIN
  UPDATE students SET coins = coins + NEW.price_coins WHERE id = NEW.student_id;
  UPDATE gift_catalog_items
  SET stock_remaining = MIN(stock_total, stock_remaining + 1),
      updated_at = NEW.updated_at
  WHERE id = NEW.item_id;
  UPDATE gift_vouchers SET status = 'CANCELLED' WHERE order_id = NEW.id;

  INSERT INTO gift_wallet_ledger
    (id, student_id, delta_coins, reason, ref_order_id, created_at)
  VALUES
    ('gled-' || lower(hex(randomblob(8))), NEW.student_id, NEW.price_coins, 'REFUND', NEW.id, NEW.cancelled_at);

  INSERT INTO gift_order_events
    (id, event_type, order_id, student_id, actor, metadata, created_at, request_id)
  VALUES
    ('gevo-' || lower(hex(randomblob(8))), 'ORDER_CANCELLED', NEW.id, NEW.student_id,
     NEW.transition_actor, json_object('reason', NEW.cancel_reason),
     NEW.cancelled_at, NEW.transition_request_id);

  INSERT INTO gift_order_events
    (id, event_type, order_id, student_id, actor, metadata, created_at, request_id)
  VALUES
    ('gevo-' || lower(hex(randomblob(8))), 'WALLET_REFUNDED', NEW.id, NEW.student_id,
     NEW.transition_actor, json_object('amount', NEW.price_coins),
     NEW.cancelled_at, NEW.transition_request_id);
END;
