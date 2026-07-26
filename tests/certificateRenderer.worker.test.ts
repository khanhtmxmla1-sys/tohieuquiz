import { describe, expect, it } from 'vitest';
import { loadCertificateFonts, loadFont } from '../workers/src/services/fontLoader';
import { buildCertificateSvg } from '../workers/src/services/certificateSvg';
import { previewFontAssets } from '../workers/src/routes/certificates/previewAssets';

describe('certificate SVG renderer', () => {
  it('keeps Vietnamese, score zero, long text constraints, and escapes XML', () => {
    const svg = buildCertificateSvg('data:image/png;base64,AA==', [
      { key: 'student_name', x: 100, y: 100, fontSize: 36, maxWidth: 420 },
      { key: 'score', x: 100, y: 160, fontSize: 24 },
      { key: 'quiz_title', x: 100, y: 220, fontSize: 20, maxWidth: 500 },
    ], {
      student_name: 'Nguyễn Việt Anh & <Bạn>', score: '0/10',
      quiz_title: 'Bài kiểm tra tiếng Việt rất dài '.repeat(20),
      date: '14/07/2026', teacher_name: 'Cô Nguyễn', custom_note: '',
    }, 1200, 848);

    expect(svg).toContain('Nguyễn Việt Anh &amp; &lt;Bạn&gt;');
    expect(svg).toContain('0/10');
    expect(svg).not.toContain('textLength=');
    expect(svg).toContain('font-family="Roboto"');
    expect(svg).not.toContain('& <Bạn>');
  });

  it('uses an alphabetic baseline and only shrinks text that exceeds its guide line', () => {
    const shortSvg = buildCertificateSvg('data:image/png;base64,AA==', [
      {
        key: 'student_name',
        x: 635,
        y: 310,
        fontSize: 60,
        fontFamily: 'Great Vibes',
        baseline: 'alphabetic',
        maxWidth: 680,
      },
    ], {
      student_name: 'Lê Văn Tuấn', score: '', quiz_title: '', date: '', teacher_name: '', custom_note: '',
    }, 1270, 698);
    const longSvg = buildCertificateSvg('data:image/png;base64,AA==', [
      {
        key: 'student_name',
        x: 635,
        y: 310,
        fontSize: 60,
        fontFamily: 'Great Vibes',
        baseline: 'alphabetic',
        maxWidth: 360,
      },
    ], {
      student_name: 'Nguyễn Hoàng Minh Anh Phương Thảo', score: '', quiz_title: '', date: '', teacher_name: '', custom_note: '',
    }, 1270, 698);

    expect(shortSvg).toContain('dominant-baseline="alphabetic"');
    expect(shortSvg).toContain('font-size="60"');
    expect(shortSvg).not.toContain('textLength=');
    expect(longSvg).not.toContain('font-size="60"');
    expect(longSvg).not.toContain('textLength=');
  });

  it('renders static text, custom fonts, prefixes, and Vietnamese long dates', () => {
    const svg = buildCertificateSvg('data:image/png;base64,AA==', [
      { key: 'static_text', text: 'CHỨNG NHẬN', x: 600, y: 100, fontSize: 48, fontFamily: 'Spectral', fontWeight: 'bold' },
      { key: 'student_name', x: 600, y: 200, fontSize: 52, fontFamily: 'Dancing Script' },
      { key: 'score', x: 600, y: 300, fontSize: 28, prefix: 'Điểm: ' },
      { key: 'date', x: 600, y: 400, fontSize: 22, prefix: 'Mường La, ngày ', format: 'vi-long-date', fontStyle: 'italic' },
    ], {
      student_name: 'Tòng Minh Khánh', score: '9/10', quiz_title: '', date: '10/10/2026', teacher_name: '', custom_note: '',
    }, 1270, 698);

    expect(svg).toContain('CHỨNG NHẬN');
    expect(svg).toContain('font-family="Dancing Script"');
    expect(svg).toContain('Điểm: 9/10');
    expect(svg).toContain('Mường La, ngày 10 tháng 10 năm 2026');
    expect(svg).toContain('font-style="italic"');
  });

  it('fails closed when the R2 font is missing or invalid', async () => {
    await expect(loadFont({}, 'Missing-Binding')).rejects.toThrow('CERT_IMAGES binding is required');
    await expect(loadFont({ CERT_IMAGES: { get: async () => null } }, 'Missing-Object'))
      .rejects.toThrow('Certificate font not found in R2');
    await expect(loadFont({
      CERT_IMAGES: { get: async () => ({ arrayBuffer: async () => new ArrayBuffer(12) }) },
    }, 'Invalid-Object')).rejects.toThrow('Invalid certificate font in R2');
  });

  it('returns an isolated copy when a cached font buffer is reused', async () => {
    const bytes = new Uint8Array(12);
    bytes.set([0x00, 0x01, 0x00, 0x00]);
    const get = async () => ({ arrayBuffer: async () => bytes.buffer.slice(0) });
    const env = { CERT_IMAGES: { get } };

    const first = await loadFont(env, 'Cache-Isolation');
    new Uint8Array(first)[4] = 0xff;
    const second = await loadFont(env, 'Cache-Isolation');

    expect(new Uint8Array(second)[4]).toBe(0);
  });

  it('loads the elegant Vietnamese student-name font with the certificate font bundle', async () => {
    const requestedKeys: string[] = [];
    const env = {
      CERT_IMAGES: {
        get: async (key: string) => {
          requestedKeys.push(key);
          const bytes = new Uint8Array(12);
          bytes.set([0x00, 0x01, 0x00, 0x00]);
          return { arrayBuffer: async () => bytes.buffer.slice(0) };
        },
      },
    };

    await loadCertificateFonts(env);

    expect(requestedKeys).toEqual(expect.arrayContaining([
      'fonts/GreatVibes-Regular.ttf',
      'fonts/DancingScript-Bold.ttf',
      'fonts/PlaywriteVN-Regular.ttf',
      'fonts/Allura-Regular.ttf',
      'fonts/AlexBrush-Regular.ttf',
    ]));
  });

  it('maps every selectable Vietnamese name font to a preview asset', () => {
    const families = ['Great Vibes', 'Dancing Script', 'Playwrite VN', 'Allura', 'Alex Brush'] as const;
    const assets = previewFontAssets(families.map((fontFamily, index) => ({
      key: 'student_name',
      x: 100,
      y: 100 + index,
      fontSize: 48,
      fontFamily,
    })));

    expect(assets.map(asset => asset.family)).toEqual(expect.arrayContaining(families));
  });
});
