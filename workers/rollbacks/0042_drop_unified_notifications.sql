-- Rollback for 0042_unified_notifications.sql
-- Drops the unified inbox indexes. The feature itself is gated by the server-side
-- `unified_notifications_v1` system setting, so the usual way to back it out is to
-- turn that setting off — this script is only for a full schema revert.

DROP INDEX IF EXISTS idx_notifications_source_dedupe;
DROP INDEX IF EXISTS idx_notifications_inbox;

-- The columns added to `announcements` (priority, channels_json, dismissible,
-- cta_label, surface_overrides_json) and to `notifications` (priority, action_url,
-- source_type, source_id, expires_at) are intentionally retained.
-- `priority` and `dismissible` carry CHECK constraints, which SQLite/D1 refuses to
-- remove with ALTER TABLE ... DROP COLUMN; removing them requires rebuilding both
-- tables. Leaving the columns in place is harmless because every one of them is
-- either nullable or has a DEFAULT.
--
-- Note: the migration overwrote announcements.channels_json from the legacy
-- is_active / is_banner_active flags. Those legacy columns are untouched, so the
-- pre-0042 read path keeps working after this rollback.
