-- Roll back Gift Shop governance triggers and scope settings.
-- Added columns are retained because SQLite/D1 column rollback would require rebuilding live tables.
DROP TRIGGER IF EXISTS trg_gift_order_cancelled;
DROP TRIGGER IF EXISTS trg_gift_order_delivered;
DROP TRIGGER IF EXISTS trg_gift_order_approved;
DROP TRIGGER IF EXISTS trg_gift_order_transition_guard;
DROP TRIGGER IF EXISTS trg_gift_order_purchase_commit;
DROP TRIGGER IF EXISTS trg_gift_order_purchase_guard;
DROP INDEX IF EXISTS idx_gift_events_request;
DROP INDEX IF EXISTS idx_gift_scope_settings_lookup;
DROP INDEX IF EXISTS idx_gift_orders_student_item_week;
DROP INDEX IF EXISTS idx_gift_catalog_scope_stock;
DROP TABLE IF EXISTS gift_shop_scope_settings;
