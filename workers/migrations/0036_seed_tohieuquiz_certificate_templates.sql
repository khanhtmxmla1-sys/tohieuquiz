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
  'cert-backgrounds/tohieuquiz-2026/classic-red-navy.webp',
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
  'cert-backgrounds/tohieuquiz-2026/modern-color.webp',
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
  'cert-backgrounds/tohieuquiz-2026/formal-blue.webp',
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
  'cert-backgrounds/tohieuquiz-2026/kids-learning.webp',
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
  'cert-backgrounds/tohieuquiz-2026/geometric-navy-orange.webp',
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
