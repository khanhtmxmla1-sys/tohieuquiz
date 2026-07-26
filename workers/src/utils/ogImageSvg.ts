export interface PhieuRecord {
    student_name: string;
    ten_bai_tap?: string;
    batch_title?: string;
    diem_so?: number;
    xep_loai?: string;
    so_cau_dung?: number;
    tong_cau?: number;
}

const BADGE_COLOR: Record<string, string> = {
    'Giỏi': '#22c55e',
    'Khá': '#3b82f6',
    'Trung bình': '#f59e0b',
    'Yếu': '#ef4444',
};

export const escapeXml = (value: unknown): string => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

export function buildOgSvg(r: PhieuRecord): string {
    const rawName = (r.student_name || 'Học sinh').slice(0, 40);
    const rawBaiTap = (r.batch_title || r.ten_bai_tap || 'Bài kiểm tra').slice(0, 60);
    const rawXepLoai = r.xep_loai || '';
    const name = escapeXml(rawName);
    const baiTap = escapeXml(rawBaiTap);
    const diem = escapeXml(r.diem_so != null ? `${r.diem_so}/10` : '');
    const xepLoai = escapeXml(rawXepLoai);
    const cauInfo = escapeXml(r.tong_cau ? `${r.so_cau_dung ?? 0}/${r.tong_cau} câu đúng` : '');
    const bColor = BADGE_COLOR[rawXepLoai] || '#6366f1';

    const diemX = rawXepLoai && diem ? '440' : '600';
    const badgeX = diem ? 720 : 520;
    const badgeLX = diem ? '800' : '600';

    return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#4F46E5"/>
      <stop offset="100%" stop-color="#7C3AED"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <circle cx="100" cy="100" r="180" fill="rgba(255,255,255,0.04)"/>
  <circle cx="1100" cy="530" r="220" fill="rgba(255,255,255,0.04)"/>
  <text x="600" y="88" font-family="Arial,sans-serif" font-size="20" fill="rgba(255,255,255,0.55)" text-anchor="middle" letter-spacing="5">TOHIEUQUIZ · PHIEU KET QUA</text>
  <text x="600" y="210" font-family="Arial,sans-serif" font-size="64" font-weight="bold" fill="white" text-anchor="middle">${name}</text>
  <text x="600" y="272" font-family="Arial,sans-serif" font-size="28" fill="rgba(255,255,255,0.80)" text-anchor="middle">${baiTap}</text>
  <line x1="480" y1="296" x2="720" y2="296" stroke="rgba(255,255,255,0.25)" stroke-width="1"/>
  ${diem ? `<text x="${diemX}" y="400" font-family="Arial,sans-serif" font-size="84" font-weight="bold" fill="#FDE047" text-anchor="middle">${diem}</text>` : ''}
  ${xepLoai ? `<rect x="${badgeX}" y="348" width="170" height="58" rx="29" fill="${bColor}"/><text x="${badgeLX}" y="387" font-family="Arial,sans-serif" font-size="26" font-weight="bold" fill="white" text-anchor="middle">${xepLoai}</text>` : ''}
  ${cauInfo ? `<text x="600" y="470" font-family="Arial,sans-serif" font-size="24" fill="rgba(255,255,255,0.68)" text-anchor="middle">${cauInfo}</text>` : ''}
  <text x="600" y="594" font-family="Arial,sans-serif" font-size="18" fill="rgba(255,255,255,0.40)" text-anchor="middle">thtohieu.com</text>
</svg>`;
}
