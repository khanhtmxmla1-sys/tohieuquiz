import type { Env } from '../../types';
import type { JWTPayload } from '../../utils/jwt';
import { loadFont } from '../../services/fontLoader';
import { buildCertificateSvg } from '../../services/certificateSvg';
import { certificateError } from './responses';
import { arrayBufferToBase64, imageMime, previewFontAssets } from './previewAssets';
import type { PreviewContext } from './previewTypes';

export async function renderPreviewSvg(
  env: Env,
  user: JWTPayload,
  context: PreviewContext,
): Promise<Response> {
  const [background, teacher] = await Promise.all([
    env.CERT_IMAGES.get(context.template.bg_image_r2_key),
    env.DB.prepare('SELECT full_name FROM teachers WHERE username = ?')
      .bind(user.username).first<{ full_name: string }>(),
  ]);
  if (!background) {
    return certificateError(
      'CERTIFICATE_BACKGROUND_NOT_FOUND',
      'Template background is missing',
      500,
    );
  }
  const backgroundBuffer = await background.arrayBuffer();
  const fontAssets = previewFontAssets(context.fieldsConfig);
  const fontBuffers = await Promise.all(
    fontAssets.map((asset) => loadFont(env, asset.r2Name)),
  );
  const fontCss = fontAssets.map((asset, index) => {
    const bytes = new Uint8Array(fontBuffers[index]);
    const mime = bytes[0] === 0x4f && bytes[1] === 0x54 ? 'font/otf' : 'font/ttf';
    return `@font-face{font-family:'${asset.family}';src:url(data:${mime};base64,${arrayBufferToBase64(fontBuffers[index])});font-weight:${asset.weight};font-style:${asset.style};}`;
  }).join('');
  const backgroundHref = `data:${imageMime(backgroundBuffer)};base64,${arrayBufferToBase64(backgroundBuffer)}`;
  const svg = buildCertificateSvg(backgroundHref, context.fieldsConfig, {
    student_name: context.studentName,
    score: context.score !== null ? `${context.score}/10` : '',
    quiz_title: context.quizTitle,
    date: context.input.dateLine !== null
      ? context.input.dateLine
      : new Date().toLocaleDateString('vi-VN'),
    teacher_name: teacher?.full_name || 'Giáo viên',
    custom_note: '',
  }, context.template.canvas_width, context.template.canvas_height).replace(
    '>',
    `><defs><style><![CDATA[${fontCss}]]></style></defs>`,
  );
  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'private, no-store',
      'Content-Disposition': 'inline; filename="certificate-preview.svg"',
    },
  });
}
