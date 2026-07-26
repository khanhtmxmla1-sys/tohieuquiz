import { describe, expect, it } from 'vitest';
import { buildOgSvg } from '../workers/src/utils/ogImageSvg';

describe('OG image XML safety', () => {
  it('escapes every dynamic text field before embedding it in SVG', () => {
    const svg = buildOgSvg({
      student_name: '<script>alert("name")</script> & Lan',
      batch_title: 'Bài <Toán> & "Tiếng Việt"',
      xep_loai: '<Giỏi & hơn>',
      diem_so: 9,
      so_cau_dung: 9,
      tong_cau: 10,
    });

    expect(svg).not.toContain('<script>');
    expect(svg).not.toContain('<Toán>');
    expect(svg).toContain('&lt;script&gt;alert(&quot;name&quot;)&lt;/script&gt; &amp; Lan');
    expect(svg).toContain('Bài &lt;Toán&gt; &amp; &quot;Tiếng Việt&quot;');
    expect(svg).toContain('&lt;Giỏi &amp; hơn&gt;');
  });

  it('preserves Vietnamese content while producing valid escaped SVG text', () => {
    const svg = buildOgSvg({
      student_name: 'Nguyễn Hà Linh',
      batch_title: 'Bài kiểm tra Tiếng Việt',
      xep_loai: 'Giỏi',
      diem_so: 9.5,
      so_cau_dung: 19,
      tong_cau: 20,
    });

    expect(svg).toContain('Nguyễn Hà Linh');
    expect(svg).toContain('Bài kiểm tra Tiếng Việt');
    expect(svg).toContain('19/20 câu đúng');
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg.endsWith('</svg>')).toBe(true);
  });
});
