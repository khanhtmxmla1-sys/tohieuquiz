-- Preserve templates referenced by existing certificate batches while removing
-- them from all new template pickers.
UPDATE certificate_templates
SET is_active = 0, updated_at = datetime('now')
WHERE id IN (
  'tohieuquiz-generated-01-ornate-red-navy-2026',
  'tohieuquiz-generated-02-geometric-blue-gold-2026',
  'tohieuquiz-generated-03-formal-blue-administrative-2026',
  'tohieuquiz-generated-04-cheerful-school-2026',
  'tohieuquiz-generated-05-geometric-navy-orange-2026',
  'tohieuquiz-generated-06-botanical-green-gold-2026',
  'tohieuquiz-generated-07-purple-gold-ornate-2026',
  'tohieuquiz-generated-08-soft-pastel-learning-2026',
  'tohieuquiz-generated-09-premium-gold-cream-2026',
  'tohieuquiz-generated-10-festive-academic-blue-gold-2026'
);
