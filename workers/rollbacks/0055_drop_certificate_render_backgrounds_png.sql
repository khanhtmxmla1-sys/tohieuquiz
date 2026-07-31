-- Restore the previous WebP render keys. This rollback is safe only together
-- with a consumer version that still accepts WebP certificate backgrounds.
UPDATE certificate_templates
SET bg_image_r2_key = CASE id
  WHEN 'tohieuquiz-classic-red-navy-2026'
    THEN 'cert-backgrounds/tohieuquiz-2026/classic-red-navy.webp'
  WHEN 'tohieuquiz-modern-color-2026'
    THEN 'cert-backgrounds/tohieuquiz-2026/modern-color.webp'
  WHEN 'tohieuquiz-formal-blue-2026'
    THEN 'cert-backgrounds/tohieuquiz-2026/formal-blue.webp'
  WHEN 'tohieuquiz-kids-learning-2026'
    THEN 'cert-backgrounds/tohieuquiz-2026/kids-learning.webp'
  WHEN 'tohieuquiz-geometric-navy-orange-2026'
    THEN 'cert-backgrounds/tohieuquiz-2026/geometric-navy-orange.webp'
  ELSE bg_image_r2_key
END,
updated_at = datetime('now')
WHERE id IN (
  'tohieuquiz-classic-red-navy-2026',
  'tohieuquiz-modern-color-2026',
  'tohieuquiz-formal-blue-2026',
  'tohieuquiz-kids-learning-2026',
  'tohieuquiz-geometric-navy-orange-2026'
);
