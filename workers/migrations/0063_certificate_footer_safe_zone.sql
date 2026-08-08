-- Keep the date/signature block clear of decorative artwork near the bottom edge.
-- All built-in certificate canvases are 1270x698, so use one shared footer rhythm:
-- date at y=520, signature heading at y=555, teacher name at y=610.
WITH target_templates(id) AS (
  VALUES
    ('mauchuan-tohieuquiz-2026'),
    ('tohieuquiz-classic-red-navy-2026'),
    ('tohieuquiz-modern-color-2026'),
    ('tohieuquiz-formal-blue-2026'),
    ('tohieuquiz-kids-learning-2026'),
    ('tohieuquiz-geometric-navy-orange-2026'),
    ('tohieuquiz-generated-01-ornate-red-navy-2026'),
    ('tohieuquiz-generated-02-geometric-blue-gold-2026'),
    ('tohieuquiz-generated-03-formal-blue-administrative-2026'),
    ('tohieuquiz-generated-04-cheerful-school-2026'),
    ('tohieuquiz-generated-05-geometric-navy-orange-2026'),
    ('tohieuquiz-generated-06-botanical-green-gold-2026'),
    ('tohieuquiz-generated-07-purple-gold-ornate-2026'),
    ('tohieuquiz-generated-08-soft-pastel-learning-2026'),
    ('tohieuquiz-generated-09-premium-gold-cream-2026'),
    ('tohieuquiz-generated-10-festive-academic-blue-gold-2026')
)
UPDATE certificate_templates
SET fields_config = (
  SELECT json_group_array(json(updated_field))
  FROM (
    SELECT
      CAST(field.key AS INTEGER) AS field_index,
      CASE
        WHEN json_extract(field.value, '$.key') = 'date' THEN
          json_set(
            field.value,
            '$.y', 520,
            '$.baseline', 'alphabetic',
            '$.maxWidth', 450
          )
        WHEN json_extract(field.value, '$.key') = 'static_text'
          AND json_extract(field.value, '$.text') = 'GIÁO VIÊN CHỦ NHIỆM' THEN
          json_set(
            field.value,
            '$.y', 555,
            '$.baseline', 'alphabetic'
          )
        WHEN json_extract(field.value, '$.key') = 'teacher_name' THEN
          json_set(
            field.value,
            '$.y', 610,
            '$.baseline', 'alphabetic',
            '$.maxWidth', 320
          )
        ELSE field.value
      END AS updated_field
    FROM json_each(certificate_templates.fields_config) AS field
    ORDER BY field_index
  )
),
updated_at = datetime('now')
WHERE id IN (SELECT id FROM target_templates)
  AND canvas_width = 1270
  AND canvas_height = 698
  AND json_valid(fields_config) = 1;
