DROP INDEX IF EXISTS idx_result_report_items_public_link;
DROP INDEX IF EXISTS idx_result_report_items_notification;
DROP INDEX IF EXISTS idx_result_report_items_student;
DROP INDEX IF EXISTS idx_result_report_items_batch;
DROP TABLE IF EXISTS result_report_delivery_items;
DROP INDEX IF EXISTS idx_phieu_batch_teacher_request;

-- The nullable/default columns added to phieu_batch are intentionally retained.
-- D1/SQLite cannot remove them safely without rebuilding the shared legacy table.
