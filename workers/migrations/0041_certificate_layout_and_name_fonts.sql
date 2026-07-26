-- Keep the selected student-name font with the batch so the preview and final
-- PNG use the same typography.
ALTER TABLE certificate_batches
  ADD COLUMN student_name_font TEXT
  CHECK (
    student_name_font IS NULL
    OR student_name_font IN (
      'Great Vibes',
      'Dancing Script',
      'Playwrite VN',
      'Allura',
      'Alex Brush'
    )
  );

-- The score frames are part of each background image and do not share one
-- vertical center. These measured centers keep the score optically centered.
WITH score_centers(template_id, score_y) AS (
  VALUES
    ('tohieuquiz-classic-red-navy-2026', 478),
    ('tohieuquiz-modern-color-2026', 499),
    ('tohieuquiz-formal-blue-2026', 503),
    ('tohieuquiz-kids-learning-2026', 509),
    ('tohieuquiz-geometric-navy-orange-2026', 497)
)
UPDATE certificate_templates
SET fields_config = (
  SELECT json_group_array(json(
    CASE
      WHEN json_extract(field.value, '$.key') = 'student_name' THEN
        json_set(
          field.value,
          '$.baseline', 'alphabetic',
          '$.maxWidth', 680
        )
      WHEN json_extract(field.value, '$.key') = 'quiz_title' THEN
        json_set(field.value, '$.baseline', 'alphabetic')
      WHEN json_extract(field.value, '$.key') = 'score' THEN
        json_set(
          field.value,
          '$.baseline', 'middle',
          '$.y', (
            SELECT score_y
            FROM score_centers
            WHERE template_id = certificate_templates.id
          )
        )
      ELSE field.value
    END
  ))
  FROM json_each(certificate_templates.fields_config) AS field
)
WHERE id IN (SELECT template_id FROM score_centers);
