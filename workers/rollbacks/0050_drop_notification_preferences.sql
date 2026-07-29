-- Roll back notification preference tables and delivery indexes.
-- Added notification columns are retained because SQLite/D1 column rollback requires rebuilding the live table.
DROP INDEX IF EXISTS idx_notification_preferences_role;
DROP INDEX IF EXISTS idx_notifications_metrics;
DROP INDEX IF EXISTS idx_notifications_delivery_feed;
DROP INDEX IF EXISTS idx_notifications_window_dedupe;
DROP TABLE IF EXISTS notification_preferences;
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_source_dedupe
  ON notifications(user_id, user_role, source_type, source_id, type)
  WHERE source_type IS NOT NULL AND source_id IS NOT NULL;
