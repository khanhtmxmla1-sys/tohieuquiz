import { PUBLIC_PHIEU_HOST } from './constants';

export function renderOgHtml(record: any, publicToken: string): string {
    const title = escapeHtml(record.batch_title || record.ten_bai_tap || 'Phieu Ket Qua Hoc Tap');
    const studentName = escapeHtml(record.student_name || '');
    const diem = Number(record.diem_so) || 0;
    const diemText = diem % 1 === 0 ? `${diem}.0/10` : `${diem}/10`;
    const xepLoai = escapeHtml(record.xep_loai || '');
    const ogTitle = studentName ? `${studentName} - ${diemText} (${xepLoai})` : title;
    const ogDesc = studentName
        ? `${studentName} dat ${diemText}, xep loai ${xepLoai}. Xem phieu ket qua va nhan xet giao vien.`
        : 'Xem phieu ket qua va nhan xet giao vien danh cho hoc sinh.';
    const ogImage = `https://${PUBLIC_PHIEU_HOST}/p/${encodeURIComponent(publicToken)}/og-image`;
    const url = `https://${PUBLIC_PHIEU_HOST}/p/${encodeURIComponent(publicToken)}`;
    return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>${ogTitle} | TôHiệuQuiz</title>
  <meta name="description" content="${ogDesc}"/>
  <meta property="og:type" content="website"/>
  <meta property="og:site_name" content="TôHiệuQuiz"/>
  <meta property="og:title" content="${ogTitle}"/>
  <meta property="og:description" content="${ogDesc}"/>
  <meta property="og:image" content="${ogImage}"/>
  <meta property="og:image:width" content="1200"/>
  <meta property="og:image:height" content="630"/>
  <meta property="og:image:type" content="image/png"/>
  <meta property="og:url" content="${url}"/>
  <meta property="og:locale" content="vi_VN"/>
  <meta name="twitter:card" content="summary_large_image"/>
  <meta name="twitter:title" content="${ogTitle}"/>
  <meta name="twitter:description" content="${ogDesc}"/>
  <meta name="twitter:image" content="${ogImage}"/>
  <meta http-equiv="refresh" content="0;url=${url}"/>
</head>
<body>
  <h1>${ogTitle}</h1>
  <p>Dang chuyen huong den phieu ket qua...</p>
</body>
</html>`;
}

function escapeHtml(value: string): string {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
