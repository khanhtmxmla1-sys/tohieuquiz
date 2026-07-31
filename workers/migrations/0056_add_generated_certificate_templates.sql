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
