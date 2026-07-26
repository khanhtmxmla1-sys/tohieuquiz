-- Use a natural-width calligraphic font for student names on the official
-- default template. Omitting maxWidth prevents SVG textLength from stretching
-- short Vietnamese names across the entire certificate.
UPDATE certificate_templates
SET fields_config = '[
  {"key":"static_text","text":"NỀN TẢNG GIÁO DỤC","x":635,"y":70,"fontSize":28,"fontWeight":"bold","fontFamily":"Spectral"},
  {"key":"static_text","text":"TÔHIỆUQUIZ","x":635,"y":108,"fontSize":28,"fontWeight":"bold","fontFamily":"Spectral"},
  {"key":"static_text","text":"CHỨNG NHẬN","x":635,"y":210,"fontSize":58,"fontWeight":"bold","fontFamily":"Spectral"},
  {"key":"student_name","x":635,"y":304,"fontSize":64,"fontWeight":"normal","fontFamily":"Great Vibes"},
  {"key":"quiz_title","prefix":"Đã hoàn thành xuất sắc ","x":635,"y":390,"fontSize":28,"fontWeight":"bold","fontFamily":"Spectral","maxWidth":850},
  {"key":"score","prefix":"Điểm: ","x":635,"y":455,"fontSize":28,"fontWeight":"bold","fontFamily":"Spectral"},
  {"key":"date","prefix":"Ngày ","format":"vi-long-date","x":990,"y":535,"fontSize":22,"fontWeight":"bold","fontStyle":"italic","fontFamily":"Spectral","maxWidth":450},
  {"key":"static_text","text":"GIÁO VIÊN CHỦ NHIỆM","x":990,"y":580,"fontSize":20,"fontWeight":"bold","fontFamily":"Spectral"},
  {"key":"teacher_name","x":990,"y":650,"fontSize":20,"fontWeight":"bold","fontFamily":"Spectral"}
]',
    updated_at = datetime('now')
WHERE id = 'mauchuan-tohieuquiz-2026'
  AND is_default = 1;
