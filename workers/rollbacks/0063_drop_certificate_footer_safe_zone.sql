-- Restore the built-in certificate footer coordinates that existed before 0063.
WITH old_footer(template_id, date_y, heading_y, teacher_y) AS (
  VALUES
    ('mauchuan-tohieuquiz-2026', 535, 580, 650),
    ('tohieuquiz-classic-red-navy-2026', 552, 590, 646),
    ('tohieuquiz-modern-color-2026', 548, 588, 642),
    ('tohieuquiz-formal-blue-2026', 553, 594, 642),
    ('tohieuquiz-kids-learning-2026', 575, 614, 657),
    ('tohieuquiz-geometric-navy-orange-2026', 553, 596, 644),
    ('tohieuquiz-generated-01-ornate-red-navy-2026', 550, 590, 640),
    ('tohieuquiz-generated-02-geometric-blue-gold-2026', 550, 590, 640),
    ('tohieuquiz-generated-03-formal-blue-administrative-2026', 550, 590, 640),
    ('tohieuquiz-generated-04-cheerful-school-2026', 550, 590, 640),
    ('tohieuquiz-generated-05-geometric-navy-orange-2026', 550, 590, 640),
    ('tohieuquiz-generated-06-botanical-green-gold-2026', 550, 590, 640),
    ('tohieuquiz-generated-07-purple-gold-ornate-2026', 550, 590, 640),
    ('tohieuquiz-generated-08-soft-pastel-learning-2026', 550, 590, 640),
    ('tohieuquiz-generated-09-premium-gold-cream-2026', 550, 590, 640),
    ('tohieuquiz-generated-10-festive-academic-blue-gold-2026', 550, 590, 640)
)
UPDATE certificate_templates
SET fields_config = (
  SELECT json_group_array(json(restored_field))
  FROM (
    SELECT
      CAST(field.key AS INTEGER) AS field_index,
      CASE
        WHEN json_extract(field.value, '$.key') = 'date' THEN
          CASE
            WHEN certificate_templates.id = 'mauchuan-tohieuquiz-2026' THEN
              json_remove(
                json_set(
                  field.value,
                  '$.y', (SELECT date_y FROM old_footer WHERE template_id = certificate_templates.id),
                  '$.maxWidth', 450
                ),
                '$.baseline'
              )
            ELSE
              json_remove(
                json_set(
                  field.value,
                  '$.y', (SELECT date_y FROM old_footer WHERE template_id = certificate_templates.id)
                ),
                '$.baseline', '$.maxWidth'
              )
          END
        WHEN json_extract(field.value, '$.key') = 'static_text'
          AND json_extract(field.value, '$.text') = 'GIÁO VIÊN CHỦ NHIỆM' THEN
          json_remove(
            json_set(
              field.value,
              '$.y', (SELECT heading_y FROM old_footer WHERE template_id = certificate_templates.id)
            ),
            '$.baseline'
          )
        WHEN json_extract(field.value, '$.key') = 'teacher_name' THEN
          json_remove(
            json_set(
              field.value,
              '$.y', (SELECT teacher_y FROM old_footer WHERE template_id = certificate_templates.id)
            ),
            '$.baseline', '$.maxWidth'
          )
        ELSE field.value
      END AS restored_field
    FROM json_each(certificate_templates.fields_config) AS field
    ORDER BY field_index
  )
),
updated_at = datetime('now')
WHERE id IN (SELECT template_id FROM old_footer)
  AND json_valid(fields_config) = 1;
