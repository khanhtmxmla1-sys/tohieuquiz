-- Resvg renders certificate text to PNG but silently omits embedded WebP images.
-- Keep WebP thumbnail keys for the template picker and switch only the source
-- artwork used by the certificate renderer to lossless PNG files.
UPDATE certificate_templates
SET bg_image_r2_key = CASE id
  WHEN 'tohieuquiz-classic-red-navy-2026'
    THEN 'cert-backgrounds/tohieuquiz-2026/classic-red-navy.png'
  WHEN 'tohieuquiz-modern-color-2026'
    THEN 'cert-backgrounds/tohieuquiz-2026/modern-color.png'
  WHEN 'tohieuquiz-formal-blue-2026'
    THEN 'cert-backgrounds/tohieuquiz-2026/formal-blue.png'
  WHEN 'tohieuquiz-kids-learning-2026'
    THEN 'cert-backgrounds/tohieuquiz-2026/kids-learning.png'
  WHEN 'tohieuquiz-geometric-navy-orange-2026'
    THEN 'cert-backgrounds/tohieuquiz-2026/geometric-navy-orange.png'
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
