import { verifyJWTMiddleware, requireTeacher } from '../../middleware/jwtAuth';
import type { Env } from '../../types';
import { certificateError } from './responses';
import { loadPreviewContext } from './previewContext';
import { parsePreviewRequest } from './previewRequest';
import { renderPreviewSvg } from './previewRenderer';

export async function handleRenderCertificatePreview(
  request: Request,
  env: Env,
): Promise<Response> {
  const authResult = await verifyJWTMiddleware(request, env);
  if (authResult instanceof Response) return authResult;
  if (!requireTeacher(authResult.user)) {
    return certificateError('CERTIFICATE_FORBIDDEN', 'Forbidden', 403);
  }
  const input = await parsePreviewRequest(request);
  if (input instanceof Response) return input;
  const context = await loadPreviewContext(env, authResult.user, input);
  if (context instanceof Response) return context;
  return renderPreviewSvg(env, authResult.user, context);
}
