-- TôHiệuQuiz non-sensitive bootstrap data.
-- Safe to rerun: settings use INSERT OR IGNORE and templates use UPSERT.

INSERT OR IGNORE INTO system_settings (setting_key, setting_value, updated_at)
VALUES ('ai_assistant_enabled', 'true', datetime('now'));
-- Seed five global certificate templates approved for the TôHiệuQuiz system.
-- Backgrounds contain decoration only. Every visible text value is rendered by
-- the certificate engine from fields_config so student, quiz, score, date, and
-- teacher data remain dynamic.

-- Retire the three early placeholder templates. Keep the official TôHiệuQuiz
-- default template active alongside the five approved designs below.
UPDATE certificate_templates
SET is_active = 0, updated_at = datetime('now')
WHERE id IN ('mau1cert2026abc', 'mau2cert2026abc', 'mau3cert2026abc');

INSERT INTO certificate_templates (
  id, school_id, name, description, bg_image_r2_key, thumbnail_r2_key,
  fields_config, is_active, is_default, canvas_width, canvas_height,
  created_by, created_at, updated_at
) VALUES
(
  'tohieuquiz-classic-red-navy-2026', NULL,
  'TôHiệuQuiz – Cổ điển Đỏ Xanh',
  'Khung vàng trang trọng, dải lụa đỏ xanh và huy hiệu học thuật.',
  'cert-backgrounds/tohieuquiz-2026/classic-red-navy.png',
  'cert-backgrounds/tohieuquiz-2026/classic-red-navy.webp',
  '[
    {"key":"static_text","text":"NỀN TẢNG GIÁO DỤC","x":635,"y":54,"fontSize":22,"fontWeight":"bold","fontFamily":"Spectral","color":"#0b2347"},
    {"key":"static_text","text":"TÔHIỆUQUIZ","x":635,"y":86,"fontSize":24,"fontWeight":"bold","fontFamily":"Spectral","color":"#0b2347"},
    {"key":"static_text","text":"CHỨNG NHẬN","x":635,"y":174,"fontSize":54,"fontWeight":"bold","fontFamily":"Spectral","color":"#b10d1d"},
    {"key":"static_text","text":"Tặng","x":635,"y":238,"fontSize":22,"fontStyle":"italic","fontFamily":"Spectral","color":"#0b2347"},
    {"key":"student_name","x":635,"y":310,"fontSize":62,"fontFamily":"Great Vibes","color":"#0a2349"},
    {"key":"quiz_title","prefix":"Đã hoàn thành xuất sắc ","x":635,"y":397,"fontSize":24,"fontWeight":"bold","fontFamily":"Spectral","color":"#a90d1c","maxWidth":760},
    {"key":"score","prefix":"Điểm: ","x":635,"y":480,"fontSize":30,"fontWeight":"bold","fontFamily":"Spectral","color":"#b10d1d"},
    {"key":"date","prefix":"Ngày ","format":"vi-long-date","x":1160,"y":552,"fontSize":17,"fontStyle":"italic","fontFamily":"Spectral","color":"#0b2347","align":"right"},
    {"key":"static_text","text":"GIÁO VIÊN CHỦ NHIỆM","x":1060,"y":590,"fontSize":18,"fontWeight":"bold","fontFamily":"Spectral","color":"#0b2347"},
    {"key":"teacher_name","x":1060,"y":646,"fontSize":19,"fontWeight":"bold","fontFamily":"Spectral","color":"#0b2347"}
  ]',
  1, 0, 1270, 698, 'admin', datetime('now'), datetime('now')
),
(
  'tohieuquiz-modern-color-2026', NULL,
  'TôHiệuQuiz – Hiện đại Đa sắc',
  'Mảng màu xanh cam năng động, cúp vàng và huy hiệu trung tâm.',
  'cert-backgrounds/tohieuquiz-2026/modern-color.png',
  'cert-backgrounds/tohieuquiz-2026/modern-color.webp',
  '[
    {"key":"static_text","text":"NỀN TẢNG GIÁO DỤC","x":635,"y":55,"fontSize":22,"fontWeight":"bold","fontFamily":"Spectral","color":"#092957"},
    {"key":"static_text","text":"TÔHIỆUQUIZ","x":635,"y":88,"fontSize":24,"fontWeight":"bold","fontFamily":"Spectral","color":"#092957"},
    {"key":"static_text","text":"CHỨNG NHẬN","x":635,"y":168,"fontSize":52,"fontWeight":"bold","fontFamily":"Spectral","color":"#d20b19"},
    {"key":"static_text","text":"Tặng","x":635,"y":229,"fontSize":22,"fontStyle":"italic","fontFamily":"Spectral","color":"#092957"},
    {"key":"student_name","x":635,"y":302,"fontSize":60,"fontFamily":"Great Vibes","color":"#082b62"},
    {"key":"quiz_title","prefix":"Đã hoàn thành xuất sắc ","x":635,"y":390,"fontSize":24,"fontWeight":"bold","fontFamily":"Spectral","color":"#f0640c","maxWidth":720},
    {"key":"score","prefix":"Điểm: ","x":635,"y":477,"fontSize":30,"fontWeight":"bold","fontFamily":"Spectral","color":"#d20b19"},
    {"key":"date","prefix":"Ngày ","format":"vi-long-date","x":1160,"y":548,"fontSize":17,"fontStyle":"italic","fontFamily":"Spectral","color":"#092957","align":"right"},
    {"key":"static_text","text":"GIÁO VIÊN CHỦ NHIỆM","x":1065,"y":588,"fontSize":18,"fontWeight":"bold","fontFamily":"Spectral","color":"#092957"},
    {"key":"teacher_name","x":1065,"y":642,"fontSize":19,"fontWeight":"bold","fontFamily":"Spectral","color":"#092957"}
  ]',
  1, 0, 1270, 698, 'admin', datetime('now'), datetime('now')
),
(
  'tohieuquiz-formal-blue-2026', NULL,
  'TôHiệuQuiz – Hành chính Khung xanh',
  'Phong cách hành chính trang trọng với khung hoa văn xanh cổ điển.',
  'cert-backgrounds/tohieuquiz-2026/formal-blue.png',
  'cert-backgrounds/tohieuquiz-2026/formal-blue.webp',
  '[
    {"key":"static_text","text":"NỀN TẢNG GIÁO DỤC","x":635,"y":58,"fontSize":22,"fontWeight":"bold","fontFamily":"Spectral","color":"#0d3d85"},
    {"key":"static_text","text":"TÔHIỆUQUIZ","x":635,"y":92,"fontSize":24,"fontWeight":"bold","fontFamily":"Spectral","color":"#0d3d85"},
    {"key":"static_text","text":"CHỨNG NHẬN","x":635,"y":181,"fontSize":54,"fontWeight":"bold","fontFamily":"Spectral","color":"#0b3b82"},
    {"key":"static_text","text":"Tặng","x":635,"y":242,"fontSize":22,"fontStyle":"italic","fontFamily":"Spectral","color":"#0b3b82"},
    {"key":"student_name","x":635,"y":309,"fontSize":60,"fontFamily":"Great Vibes","color":"#0b3b82"},
    {"key":"quiz_title","prefix":"Đã hoàn thành xuất sắc ","x":635,"y":394,"fontSize":23,"fontWeight":"bold","fontFamily":"Spectral","color":"#0b3b82","maxWidth":760},
    {"key":"score","prefix":"Điểm: ","x":635,"y":485,"fontSize":30,"fontWeight":"bold","fontFamily":"Spectral","color":"#c11e2e"},
    {"key":"date","prefix":"Ngày ","format":"vi-long-date","x":1125,"y":553,"fontSize":17,"fontStyle":"italic","fontFamily":"Spectral","color":"#0b3b82","align":"right"},
    {"key":"static_text","text":"GIÁO VIÊN CHỦ NHIỆM","x":1025,"y":594,"fontSize":18,"fontWeight":"bold","fontFamily":"Spectral","color":"#0b3b82"},
    {"key":"teacher_name","x":1025,"y":642,"fontSize":19,"fontWeight":"bold","fontFamily":"Spectral","color":"#0b3b82"}
  ]',
  1, 0, 1270, 698, 'admin', datetime('now'), datetime('now')
),
(
  'tohieuquiz-kids-learning-2026', NULL,
  'TôHiệuQuiz – Thiếu nhi Vui học',
  'Minh họa học sinh tốt nghiệp, sách vở và dụng cụ khoa học nhiều màu.',
  'cert-backgrounds/tohieuquiz-2026/kids-learning.png',
  'cert-backgrounds/tohieuquiz-2026/kids-learning.webp',
  '[
    {"key":"static_text","text":"NỀN TẢNG GIÁO DỤC","x":635,"y":53,"fontSize":20,"fontWeight":"bold","fontFamily":"Spectral","color":"#102e64"},
    {"key":"static_text","text":"TÔHIỆUQUIZ","x":635,"y":85,"fontSize":22,"fontWeight":"bold","fontFamily":"Spectral","color":"#102e64"},
    {"key":"static_text","text":"CHỨNG NHẬN","x":635,"y":161,"fontSize":50,"fontWeight":"bold","fontFamily":"Spectral","color":"#e7463c"},
    {"key":"static_text","text":"Tặng","x":635,"y":227,"fontSize":21,"fontStyle":"italic","fontFamily":"Spectral","color":"#e58c13"},
    {"key":"student_name","x":635,"y":307,"fontSize":57,"fontFamily":"Great Vibes","color":"#cf202f"},
    {"key":"quiz_title","prefix":"Đã hoàn thành xuất sắc ","x":635,"y":401,"fontSize":22,"fontWeight":"bold","fontFamily":"Spectral","color":"#287b38","maxWidth":610},
    {"key":"score","prefix":"Điểm: ","x":635,"y":505,"fontSize":30,"fontWeight":"bold","fontFamily":"Spectral","color":"#d8252e"},
    {"key":"date","prefix":"Ngày ","format":"vi-long-date","x":895,"y":575,"fontSize":16,"fontStyle":"italic","fontFamily":"Spectral","color":"#102e64","align":"right"},
    {"key":"static_text","text":"GIÁO VIÊN CHỦ NHIỆM","x":805,"y":614,"fontSize":17,"fontWeight":"bold","fontFamily":"Spectral","color":"#102e64"},
    {"key":"teacher_name","x":805,"y":657,"fontSize":18,"fontWeight":"bold","fontFamily":"Spectral","color":"#102e64"}
  ]',
  1, 0, 1270, 698, 'admin', datetime('now'), datetime('now')
),
(
  'tohieuquiz-geometric-navy-orange-2026', NULL,
  'TôHiệuQuiz – Hình học Xanh Cam',
  'Bố cục hình học hiện đại xanh navy và cam, phù hợp các thành tích nổi bật.',
  'cert-backgrounds/tohieuquiz-2026/geometric-navy-orange.png',
  'cert-backgrounds/tohieuquiz-2026/geometric-navy-orange.webp',
  '[
    {"key":"static_text","text":"NỀN TẢNG GIÁO DỤC","x":635,"y":55,"fontSize":22,"fontWeight":"bold","fontFamily":"Spectral","color":"#092b5d"},
    {"key":"static_text","text":"TÔHIỆUQUIZ","x":635,"y":89,"fontSize":24,"fontWeight":"bold","fontFamily":"Spectral","color":"#092b5d"},
    {"key":"static_text","text":"CHỨNG NHẬN","x":635,"y":174,"fontSize":54,"fontWeight":"bold","fontFamily":"Spectral","color":"#082b60"},
    {"key":"static_text","text":"Tặng","x":635,"y":237,"fontSize":22,"fontStyle":"italic","fontFamily":"Spectral","color":"#082b60"},
    {"key":"student_name","x":635,"y":310,"fontSize":60,"fontFamily":"Great Vibes","color":"#082b60"},
    {"key":"quiz_title","prefix":"Đã hoàn thành xuất sắc ","x":635,"y":401,"fontSize":24,"fontWeight":"bold","fontFamily":"Spectral","color":"#f0650d","maxWidth":720},
    {"key":"score","prefix":"Điểm: ","x":635,"y":484,"fontSize":30,"fontWeight":"bold","fontFamily":"Spectral","color":"#e52d16"},
    {"key":"date","prefix":"Ngày ","format":"vi-long-date","x":1120,"y":553,"fontSize":17,"fontStyle":"italic","fontFamily":"Spectral","color":"#082b60","align":"right"},
    {"key":"static_text","text":"GIÁO VIÊN CHỦ NHIỆM","x":1030,"y":596,"fontSize":18,"fontWeight":"bold","fontFamily":"Spectral","color":"#082b60"},
    {"key":"teacher_name","x":1030,"y":644,"fontSize":19,"fontWeight":"bold","fontFamily":"Spectral","color":"#082b60"}
  ]',
  1, 0, 1270, 698, 'admin', datetime('now'), datetime('now')
)
ON CONFLICT(id) DO UPDATE SET
  school_id = excluded.school_id,
  name = excluded.name,
  description = excluded.description,
  bg_image_r2_key = excluded.bg_image_r2_key,
  thumbnail_r2_key = excluded.thumbnail_r2_key,
  fields_config = excluded.fields_config,
  is_active = excluded.is_active,
  canvas_width = excluded.canvas_width,
  canvas_height = excluded.canvas_height,
  updated_at = datetime('now');

-- Use one of the approved TôHiệuQuiz templates as the global default.
UPDATE certificate_templates
SET is_default = CASE
  WHEN id = 'tohieuquiz-classic-red-navy-2026' THEN 1
  ELSE 0
END,
updated_at = datetime('now')
WHERE id IN (
  'tohieuquiz-classic-red-navy-2026',
  'tohieuquiz-modern-color-2026',
  'tohieuquiz-formal-blue-2026',
  'tohieuquiz-kids-learning-2026',
  'tohieuquiz-geometric-navy-orange-2026'
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

-- Ten generated blank-artwork certificate templates.
-- Add ten global blank-artwork certificate templates stored in private R2.
-- PNG is used for both rendering and template thumbnails so the Worker-side
-- Resvg pipeline and the browser picker read the same verified object.
INSERT INTO certificate_templates (
  id, school_id, name, description, bg_image_r2_key, thumbnail_r2_key,
  fields_config, is_active, is_default, canvas_width, canvas_height,
  created_by, created_at, updated_at
) VALUES
(
  'tohieuquiz-generated-01-ornate-red-navy-2026', NULL,
  'TôHiệuQuiz – Cổ điển Đỏ Xanh Cao cấp',
  'Khung cổ điển đỏ xanh, hoa văn vàng và vùng nội dung trang trọng.',
  'cert-backgrounds/tohieuquiz-2026/generated-10/01-ornate-red-navy.png',
  'cert-backgrounds/tohieuquiz-2026/generated-10/01-ornate-red-navy.png',
  '[{"key":"static_text","text":"NỀN TẢNG GIÁO DỤC","x":635,"y":55,"fontSize":20,"fontWeight":"bold","fontFamily":"Spectral","color":"#0b2347"},{"key":"static_text","text":"TÔHIỆUQUIZ","x":635,"y":86,"fontSize":22,"fontWeight":"bold","fontFamily":"Spectral","color":"#0b2347"},{"key":"static_text","text":"CHỨNG NHẬN","x":635,"y":170,"fontSize":52,"fontWeight":"bold","fontFamily":"Spectral","color":"#0b2347"},{"key":"static_text","text":"Tặng","x":635,"y":232,"fontSize":21,"fontStyle":"italic","fontFamily":"Spectral","color":"#0b2347"},{"key":"student_name","x":635,"y":305,"fontSize":60,"fontFamily":"Great Vibes","color":"#0b2347","baseline":"alphabetic","maxWidth":680},{"key":"quiz_title","prefix":"Đã hoàn thành xuất sắc ","x":635,"y":392,"fontSize":23,"fontWeight":"bold","fontFamily":"Spectral","color":"#b10d1d","maxWidth":720,"baseline":"alphabetic"},{"key":"score","prefix":"Điểm: ","x":635,"y":480,"fontSize":30,"fontWeight":"bold","fontFamily":"Spectral","color":"#0b2347","baseline":"middle"},{"key":"date","prefix":"Ngày ","format":"vi-long-date","x":1110,"y":550,"fontSize":16,"fontStyle":"italic","fontFamily":"Spectral","color":"#0b2347","align":"right"},{"key":"static_text","text":"GIÁO VIÊN CHỦ NHIỆM","x":1010,"y":590,"fontSize":17,"fontWeight":"bold","fontFamily":"Spectral","color":"#0b2347"},{"key":"teacher_name","x":1010,"y":640,"fontSize":18,"fontWeight":"bold","fontFamily":"Spectral","color":"#0b2347"}]',
  1, 0, 1270, 698, 'admin', datetime('now'), datetime('now')
),
(
  'tohieuquiz-generated-02-geometric-blue-gold-2026', NULL,
  'TôHiệuQuiz – Hình học Xanh Vàng',
  'Bố cục hình học xanh dương, cam vàng hiện đại và sáng rõ.',
  'cert-backgrounds/tohieuquiz-2026/generated-10/02-geometric-blue-gold.png',
  'cert-backgrounds/tohieuquiz-2026/generated-10/02-geometric-blue-gold.png',
  '[{"key":"static_text","text":"NỀN TẢNG GIÁO DỤC","x":635,"y":55,"fontSize":20,"fontWeight":"bold","fontFamily":"Spectral","color":"#0b3b82"},{"key":"static_text","text":"TÔHIỆUQUIZ","x":635,"y":86,"fontSize":22,"fontWeight":"bold","fontFamily":"Spectral","color":"#0b3b82"},{"key":"static_text","text":"CHỨNG NHẬN","x":635,"y":170,"fontSize":52,"fontWeight":"bold","fontFamily":"Spectral","color":"#0b3b82"},{"key":"static_text","text":"Tặng","x":635,"y":232,"fontSize":21,"fontStyle":"italic","fontFamily":"Spectral","color":"#0b3b82"},{"key":"student_name","x":635,"y":305,"fontSize":60,"fontFamily":"Great Vibes","color":"#0b3b82","baseline":"alphabetic","maxWidth":680},{"key":"quiz_title","prefix":"Đã hoàn thành xuất sắc ","x":635,"y":392,"fontSize":23,"fontWeight":"bold","fontFamily":"Spectral","color":"#e88700","maxWidth":720,"baseline":"alphabetic"},{"key":"score","prefix":"Điểm: ","x":635,"y":480,"fontSize":30,"fontWeight":"bold","fontFamily":"Spectral","color":"#0b3b82","baseline":"middle"},{"key":"date","prefix":"Ngày ","format":"vi-long-date","x":1110,"y":550,"fontSize":16,"fontStyle":"italic","fontFamily":"Spectral","color":"#0b3b82","align":"right"},{"key":"static_text","text":"GIÁO VIÊN CHỦ NHIỆM","x":1010,"y":590,"fontSize":17,"fontWeight":"bold","fontFamily":"Spectral","color":"#0b3b82"},{"key":"teacher_name","x":1010,"y":640,"fontSize":18,"fontWeight":"bold","fontFamily":"Spectral","color":"#0b3b82"}]',
  1, 0, 1270, 698, 'admin', datetime('now'), datetime('now')
),
(
  'tohieuquiz-generated-03-formal-blue-administrative-2026', NULL,
  'TôHiệuQuiz – Hành chính Xanh Trang trọng',
  'Khung hành chính xanh thanh lịch dành cho chứng nhận chính thức.',
  'cert-backgrounds/tohieuquiz-2026/generated-10/03-formal-blue-administrative.png',
  'cert-backgrounds/tohieuquiz-2026/generated-10/03-formal-blue-administrative.png',
  '[{"key":"static_text","text":"NỀN TẢNG GIÁO DỤC","x":635,"y":55,"fontSize":20,"fontWeight":"bold","fontFamily":"Spectral","color":"#0b3b82"},{"key":"static_text","text":"TÔHIỆUQUIZ","x":635,"y":86,"fontSize":22,"fontWeight":"bold","fontFamily":"Spectral","color":"#0b3b82"},{"key":"static_text","text":"CHỨNG NHẬN","x":635,"y":170,"fontSize":52,"fontWeight":"bold","fontFamily":"Spectral","color":"#0b3b82"},{"key":"static_text","text":"Tặng","x":635,"y":232,"fontSize":21,"fontStyle":"italic","fontFamily":"Spectral","color":"#0b3b82"},{"key":"student_name","x":635,"y":305,"fontSize":60,"fontFamily":"Great Vibes","color":"#0b3b82","baseline":"alphabetic","maxWidth":680},{"key":"quiz_title","prefix":"Đã hoàn thành xuất sắc ","x":635,"y":392,"fontSize":23,"fontWeight":"bold","fontFamily":"Spectral","color":"#a61b2b","maxWidth":720,"baseline":"alphabetic"},{"key":"score","prefix":"Điểm: ","x":635,"y":480,"fontSize":30,"fontWeight":"bold","fontFamily":"Spectral","color":"#0b3b82","baseline":"middle"},{"key":"date","prefix":"Ngày ","format":"vi-long-date","x":1110,"y":550,"fontSize":16,"fontStyle":"italic","fontFamily":"Spectral","color":"#0b3b82","align":"right"},{"key":"static_text","text":"GIÁO VIÊN CHỦ NHIỆM","x":1010,"y":590,"fontSize":17,"fontWeight":"bold","fontFamily":"Spectral","color":"#0b3b82"},{"key":"teacher_name","x":1010,"y":640,"fontSize":18,"fontWeight":"bold","fontFamily":"Spectral","color":"#0b3b82"}]',
  1, 0, 1270, 698, 'admin', datetime('now'), datetime('now')
),
(
  'tohieuquiz-generated-04-cheerful-school-2026', NULL,
  'TôHiệuQuiz – Thiếu nhi Khám phá',
  'Sách vở, khoa học và biểu tượng học tập nhiều màu dành cho học sinh nhỏ tuổi.',
  'cert-backgrounds/tohieuquiz-2026/generated-10/04-cheerful-school.png',
  'cert-backgrounds/tohieuquiz-2026/generated-10/04-cheerful-school.png',
  '[{"key":"static_text","text":"NỀN TẢNG GIÁO DỤC","x":635,"y":55,"fontSize":20,"fontWeight":"bold","fontFamily":"Spectral","color":"#164e8a"},{"key":"static_text","text":"TÔHIỆUQUIZ","x":635,"y":86,"fontSize":22,"fontWeight":"bold","fontFamily":"Spectral","color":"#164e8a"},{"key":"static_text","text":"CHỨNG NHẬN","x":635,"y":170,"fontSize":52,"fontWeight":"bold","fontFamily":"Spectral","color":"#164e8a"},{"key":"static_text","text":"Tặng","x":635,"y":232,"fontSize":21,"fontStyle":"italic","fontFamily":"Spectral","color":"#164e8a"},{"key":"student_name","x":635,"y":305,"fontSize":60,"fontFamily":"Great Vibes","color":"#164e8a","baseline":"alphabetic","maxWidth":680},{"key":"quiz_title","prefix":"Đã hoàn thành xuất sắc ","x":635,"y":392,"fontSize":23,"fontWeight":"bold","fontFamily":"Spectral","color":"#e85d04","maxWidth":720,"baseline":"alphabetic"},{"key":"score","prefix":"Điểm: ","x":635,"y":480,"fontSize":30,"fontWeight":"bold","fontFamily":"Spectral","color":"#164e8a","baseline":"middle"},{"key":"date","prefix":"Ngày ","format":"vi-long-date","x":1000,"y":550,"fontSize":16,"fontStyle":"italic","fontFamily":"Spectral","color":"#164e8a","align":"right"},{"key":"static_text","text":"GIÁO VIÊN CHỦ NHIỆM","x":900,"y":590,"fontSize":17,"fontWeight":"bold","fontFamily":"Spectral","color":"#164e8a"},{"key":"teacher_name","x":900,"y":640,"fontSize":18,"fontWeight":"bold","fontFamily":"Spectral","color":"#164e8a"}]',
  1, 0, 1270, 698, 'admin', datetime('now'), datetime('now')
),
(
  'tohieuquiz-generated-05-geometric-navy-orange-2026', NULL,
  'TôHiệuQuiz – Hiện đại Xanh Cam',
  'Mảng hình học xanh navy và cam mạnh mẽ cho thành tích nổi bật.',
  'cert-backgrounds/tohieuquiz-2026/generated-10/05-geometric-navy-orange.png',
  'cert-backgrounds/tohieuquiz-2026/generated-10/05-geometric-navy-orange.png',
  '[{"key":"static_text","text":"NỀN TẢNG GIÁO DỤC","x":635,"y":55,"fontSize":20,"fontWeight":"bold","fontFamily":"Spectral","color":"#092b5d"},{"key":"static_text","text":"TÔHIỆUQUIZ","x":635,"y":86,"fontSize":22,"fontWeight":"bold","fontFamily":"Spectral","color":"#092b5d"},{"key":"static_text","text":"CHỨNG NHẬN","x":635,"y":170,"fontSize":52,"fontWeight":"bold","fontFamily":"Spectral","color":"#092b5d"},{"key":"static_text","text":"Tặng","x":635,"y":232,"fontSize":21,"fontStyle":"italic","fontFamily":"Spectral","color":"#092b5d"},{"key":"student_name","x":635,"y":305,"fontSize":60,"fontFamily":"Great Vibes","color":"#092b5d","baseline":"alphabetic","maxWidth":680},{"key":"quiz_title","prefix":"Đã hoàn thành xuất sắc ","x":635,"y":392,"fontSize":23,"fontWeight":"bold","fontFamily":"Spectral","color":"#f0640c","maxWidth":720,"baseline":"alphabetic"},{"key":"score","prefix":"Điểm: ","x":635,"y":480,"fontSize":30,"fontWeight":"bold","fontFamily":"Spectral","color":"#092b5d","baseline":"middle"},{"key":"date","prefix":"Ngày ","format":"vi-long-date","x":1110,"y":550,"fontSize":16,"fontStyle":"italic","fontFamily":"Spectral","color":"#092b5d","align":"right"},{"key":"static_text","text":"GIÁO VIÊN CHỦ NHIỆM","x":1010,"y":590,"fontSize":17,"fontWeight":"bold","fontFamily":"Spectral","color":"#092b5d"},{"key":"teacher_name","x":1010,"y":640,"fontSize":18,"fontWeight":"bold","fontFamily":"Spectral","color":"#092b5d"}]',
  1, 0, 1270, 698, 'admin', datetime('now'), datetime('now')
),
(
  'tohieuquiz-generated-06-botanical-green-gold-2026', NULL,
  'TôHiệuQuiz – Lá Xanh Thanh lịch',
  'Họa tiết lá xanh và đường viền vàng nhẹ nhàng, tinh tế.',
  'cert-backgrounds/tohieuquiz-2026/generated-10/06-botanical-green-gold.png',
  'cert-backgrounds/tohieuquiz-2026/generated-10/06-botanical-green-gold.png',
  '[{"key":"static_text","text":"NỀN TẢNG GIÁO DỤC","x":635,"y":55,"fontSize":20,"fontWeight":"bold","fontFamily":"Spectral","color":"#285c45"},{"key":"static_text","text":"TÔHIỆUQUIZ","x":635,"y":86,"fontSize":22,"fontWeight":"bold","fontFamily":"Spectral","color":"#285c45"},{"key":"static_text","text":"CHỨNG NHẬN","x":635,"y":170,"fontSize":52,"fontWeight":"bold","fontFamily":"Spectral","color":"#285c45"},{"key":"static_text","text":"Tặng","x":635,"y":232,"fontSize":21,"fontStyle":"italic","fontFamily":"Spectral","color":"#285c45"},{"key":"student_name","x":635,"y":305,"fontSize":60,"fontFamily":"Great Vibes","color":"#285c45","baseline":"alphabetic","maxWidth":680},{"key":"quiz_title","prefix":"Đã hoàn thành xuất sắc ","x":635,"y":392,"fontSize":23,"fontWeight":"bold","fontFamily":"Spectral","color":"#a8781b","maxWidth":720,"baseline":"alphabetic"},{"key":"score","prefix":"Điểm: ","x":635,"y":480,"fontSize":30,"fontWeight":"bold","fontFamily":"Spectral","color":"#285c45","baseline":"middle"},{"key":"date","prefix":"Ngày ","format":"vi-long-date","x":1000,"y":550,"fontSize":16,"fontStyle":"italic","fontFamily":"Spectral","color":"#285c45","align":"right"},{"key":"static_text","text":"GIÁO VIÊN CHỦ NHIỆM","x":900,"y":590,"fontSize":17,"fontWeight":"bold","fontFamily":"Spectral","color":"#285c45"},{"key":"teacher_name","x":900,"y":640,"fontSize":18,"fontWeight":"bold","fontFamily":"Spectral","color":"#285c45"}]',
  1, 0, 1270, 698, 'admin', datetime('now'), datetime('now')
),
(
  'tohieuquiz-generated-07-purple-gold-ornate-2026', NULL,
  'TôHiệuQuiz – Tím Vàng Sang trọng',
  'Khung tím vàng cổ điển với hoa văn trang trí cao cấp.',
  'cert-backgrounds/tohieuquiz-2026/generated-10/07-purple-gold-ornate.png',
  'cert-backgrounds/tohieuquiz-2026/generated-10/07-purple-gold-ornate.png',
  '[{"key":"static_text","text":"NỀN TẢNG GIÁO DỤC","x":635,"y":55,"fontSize":20,"fontWeight":"bold","fontFamily":"Spectral","color":"#54205f"},{"key":"static_text","text":"TÔHIỆUQUIZ","x":635,"y":86,"fontSize":22,"fontWeight":"bold","fontFamily":"Spectral","color":"#54205f"},{"key":"static_text","text":"CHỨNG NHẬN","x":635,"y":170,"fontSize":52,"fontWeight":"bold","fontFamily":"Spectral","color":"#54205f"},{"key":"static_text","text":"Tặng","x":635,"y":232,"fontSize":21,"fontStyle":"italic","fontFamily":"Spectral","color":"#54205f"},{"key":"student_name","x":635,"y":305,"fontSize":60,"fontFamily":"Great Vibes","color":"#54205f","baseline":"alphabetic","maxWidth":680},{"key":"quiz_title","prefix":"Đã hoàn thành xuất sắc ","x":635,"y":392,"fontSize":23,"fontWeight":"bold","fontFamily":"Spectral","color":"#a8781b","maxWidth":720,"baseline":"alphabetic"},{"key":"score","prefix":"Điểm: ","x":635,"y":480,"fontSize":30,"fontWeight":"bold","fontFamily":"Spectral","color":"#54205f","baseline":"middle"},{"key":"date","prefix":"Ngày ","format":"vi-long-date","x":1110,"y":550,"fontSize":16,"fontStyle":"italic","fontFamily":"Spectral","color":"#54205f","align":"right"},{"key":"static_text","text":"GIÁO VIÊN CHỦ NHIỆM","x":1010,"y":590,"fontSize":17,"fontWeight":"bold","fontFamily":"Spectral","color":"#54205f"},{"key":"teacher_name","x":1010,"y":640,"fontSize":18,"fontWeight":"bold","fontFamily":"Spectral","color":"#54205f"}]',
  1, 0, 1270, 698, 'admin', datetime('now'), datetime('now')
),
(
  'tohieuquiz-generated-08-soft-pastel-learning-2026', NULL,
  'TôHiệuQuiz – Pastel Học đường',
  'Màu pastel dịu nhẹ, thân thiện cho thành tích học tập hằng ngày.',
  'cert-backgrounds/tohieuquiz-2026/generated-10/08-soft-pastel-learning.png',
  'cert-backgrounds/tohieuquiz-2026/generated-10/08-soft-pastel-learning.png',
  '[{"key":"static_text","text":"NỀN TẢNG GIÁO DỤC","x":635,"y":55,"fontSize":20,"fontWeight":"bold","fontFamily":"Spectral","color":"#326a94"},{"key":"static_text","text":"TÔHIỆUQUIZ","x":635,"y":86,"fontSize":22,"fontWeight":"bold","fontFamily":"Spectral","color":"#326a94"},{"key":"static_text","text":"CHỨNG NHẬN","x":635,"y":170,"fontSize":52,"fontWeight":"bold","fontFamily":"Spectral","color":"#326a94"},{"key":"static_text","text":"Tặng","x":635,"y":232,"fontSize":21,"fontStyle":"italic","fontFamily":"Spectral","color":"#326a94"},{"key":"student_name","x":635,"y":305,"fontSize":60,"fontFamily":"Great Vibes","color":"#326a94","baseline":"alphabetic","maxWidth":680},{"key":"quiz_title","prefix":"Đã hoàn thành xuất sắc ","x":635,"y":392,"fontSize":23,"fontWeight":"bold","fontFamily":"Spectral","color":"#e78a62","maxWidth":720,"baseline":"alphabetic"},{"key":"score","prefix":"Điểm: ","x":635,"y":480,"fontSize":30,"fontWeight":"bold","fontFamily":"Spectral","color":"#326a94","baseline":"middle"},{"key":"date","prefix":"Ngày ","format":"vi-long-date","x":1000,"y":550,"fontSize":16,"fontStyle":"italic","fontFamily":"Spectral","color":"#326a94","align":"right"},{"key":"static_text","text":"GIÁO VIÊN CHỦ NHIỆM","x":900,"y":590,"fontSize":17,"fontWeight":"bold","fontFamily":"Spectral","color":"#326a94"},{"key":"teacher_name","x":900,"y":640,"fontSize":18,"fontWeight":"bold","fontFamily":"Spectral","color":"#326a94"}]',
  1, 0, 1270, 698, 'admin', datetime('now'), datetime('now')
),
(
  'tohieuquiz-generated-09-premium-gold-cream-2026', NULL,
  'TôHiệuQuiz – Vàng Kem Cao cấp',
  'Khung vàng kem cao cấp, phù hợp vinh danh và tuyên dương.',
  'cert-backgrounds/tohieuquiz-2026/generated-10/09-premium-gold-cream.png',
  'cert-backgrounds/tohieuquiz-2026/generated-10/09-premium-gold-cream.png',
  '[{"key":"static_text","text":"NỀN TẢNG GIÁO DỤC","x":635,"y":55,"fontSize":20,"fontWeight":"bold","fontFamily":"Spectral","color":"#6d4a12"},{"key":"static_text","text":"TÔHIỆUQUIZ","x":635,"y":86,"fontSize":22,"fontWeight":"bold","fontFamily":"Spectral","color":"#6d4a12"},{"key":"static_text","text":"CHỨNG NHẬN","x":635,"y":170,"fontSize":52,"fontWeight":"bold","fontFamily":"Spectral","color":"#6d4a12"},{"key":"static_text","text":"Tặng","x":635,"y":232,"fontSize":21,"fontStyle":"italic","fontFamily":"Spectral","color":"#6d4a12"},{"key":"student_name","x":635,"y":305,"fontSize":60,"fontFamily":"Great Vibes","color":"#6d4a12","baseline":"alphabetic","maxWidth":680},{"key":"quiz_title","prefix":"Đã hoàn thành xuất sắc ","x":635,"y":392,"fontSize":23,"fontWeight":"bold","fontFamily":"Spectral","color":"#ad7b19","maxWidth":720,"baseline":"alphabetic"},{"key":"score","prefix":"Điểm: ","x":635,"y":480,"fontSize":30,"fontWeight":"bold","fontFamily":"Spectral","color":"#6d4a12","baseline":"middle"},{"key":"date","prefix":"Ngày ","format":"vi-long-date","x":1110,"y":550,"fontSize":16,"fontStyle":"italic","fontFamily":"Spectral","color":"#6d4a12","align":"right"},{"key":"static_text","text":"GIÁO VIÊN CHỦ NHIỆM","x":1010,"y":590,"fontSize":17,"fontWeight":"bold","fontFamily":"Spectral","color":"#6d4a12"},{"key":"teacher_name","x":1010,"y":640,"fontSize":18,"fontWeight":"bold","fontFamily":"Spectral","color":"#6d4a12"}]',
  1, 0, 1270, 698, 'admin', datetime('now'), datetime('now')
),
(
  'tohieuquiz-generated-10-festive-academic-blue-gold-2026', NULL,
  'TôHiệuQuiz – Học thuật Xanh Vàng Lễ hội',
  'Phong cách học thuật xanh vàng với họa tiết chúc mừng thành tích.',
  'cert-backgrounds/tohieuquiz-2026/generated-10/10-festive-academic-blue-gold.png',
  'cert-backgrounds/tohieuquiz-2026/generated-10/10-festive-academic-blue-gold.png',
  '[{"key":"static_text","text":"CHỨNG NHẬN","x":635,"y":205,"fontSize":50,"fontWeight":"bold","fontFamily":"Spectral","color":"#0b3b82"},{"key":"static_text","text":"Tặng","x":635,"y":260,"fontSize":21,"fontStyle":"italic","fontFamily":"Spectral","color":"#0b3b82"},{"key":"student_name","x":635,"y":330,"fontSize":58,"fontFamily":"Great Vibes","color":"#0b3b82","baseline":"alphabetic","maxWidth":680},{"key":"quiz_title","prefix":"Đã hoàn thành xuất sắc ","x":635,"y":410,"fontSize":23,"fontWeight":"bold","fontFamily":"Spectral","color":"#b88414","maxWidth":720,"baseline":"alphabetic"},{"key":"score","prefix":"Điểm: ","x":635,"y":495,"fontSize":30,"fontWeight":"bold","fontFamily":"Spectral","color":"#0b3b82","baseline":"middle"},{"key":"date","prefix":"Ngày ","format":"vi-long-date","x":1110,"y":550,"fontSize":16,"fontStyle":"italic","fontFamily":"Spectral","color":"#0b3b82","align":"right"},{"key":"static_text","text":"GIÁO VIÊN CHỦ NHIỆM","x":1010,"y":590,"fontSize":17,"fontWeight":"bold","fontFamily":"Spectral","color":"#0b3b82"},{"key":"teacher_name","x":1010,"y":640,"fontSize":18,"fontWeight":"bold","fontFamily":"Spectral","color":"#0b3b82"}]',
  1, 0, 1270, 698, 'admin', datetime('now'), datetime('now')
)
ON CONFLICT(id) DO UPDATE SET
  school_id = excluded.school_id,
  name = excluded.name,
  description = excluded.description,
  bg_image_r2_key = excluded.bg_image_r2_key,
  thumbnail_r2_key = excluded.thumbnail_r2_key,
  fields_config = excluded.fields_config,
  is_active = excluded.is_active,
  canvas_width = excluded.canvas_width,
  canvas_height = excluded.canvas_height,
  updated_at = datetime('now');

-- Normalize the built-in certificate footer into a shared safe zone so the
-- date and teacher signature stay clear of decorative artwork near the edge.
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
          json_set(field.value, '$.y', 520, '$.baseline', 'alphabetic', '$.maxWidth', 450)
        WHEN json_extract(field.value, '$.key') = 'static_text'
          AND json_extract(field.value, '$.text') = 'GIÁO VIÊN CHỦ NHIỆM' THEN
          json_set(field.value, '$.y', 555, '$.baseline', 'alphabetic')
        WHEN json_extract(field.value, '$.key') = 'teacher_name' THEN
          json_set(field.value, '$.y', 610, '$.baseline', 'alphabetic', '$.maxWidth', 320)
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
