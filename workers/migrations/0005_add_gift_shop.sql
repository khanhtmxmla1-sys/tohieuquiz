-- Gift Shop Phase 2 tables

CREATE TABLE IF NOT EXISTS gift_catalog_items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  price_coins INTEGER NOT NULL,
  image_url TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS gift_orders (
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

CREATE TABLE IF NOT EXISTS gift_vouchers (
  code TEXT PRIMARY KEY,
  order_id TEXT UNIQUE NOT NULL,
  student_id TEXT NOT NULL,
  issued_at TEXT NOT NULL,
  status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS gift_wallet_ledger (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  delta_coins INTEGER NOT NULL,
  reason TEXT NOT NULL,
  ref_order_id TEXT DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS gift_order_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  order_id TEXT DEFAULT '',
  student_id TEXT DEFAULT '',
  actor TEXT DEFAULT '',
  metadata TEXT DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_gift_catalog_active ON gift_catalog_items(is_active);
CREATE INDEX IF NOT EXISTS idx_gift_orders_status ON gift_orders(status);
CREATE INDEX IF NOT EXISTS idx_gift_orders_student ON gift_orders(student_id);
CREATE INDEX IF NOT EXISTS idx_gift_orders_class ON gift_orders(class_id);
CREATE INDEX IF NOT EXISTS idx_gift_orders_updated_at ON gift_orders(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_gift_vouchers_order ON gift_vouchers(order_id);
CREATE INDEX IF NOT EXISTS idx_gift_ledger_student ON gift_wallet_ledger(student_id);
CREATE INDEX IF NOT EXISTS idx_gift_events_created_at ON gift_order_events(created_at DESC);
