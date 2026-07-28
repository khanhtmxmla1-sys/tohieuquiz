import { AiTutorDiagnoseRequestSchema, AiTutorProviderOutputSchema } from '../../../shared/ai-tutor.contract';
import type { Env } from '../types';
import { verifyJWTMiddleware } from '../middleware/jwtAuth';
import { jsonResponse } from '../utils/response';
import { loadAuthorizedAiTutorResult } from '../services/aiTutorAuthorization';
import { loadAiTutorWrongQuestionContext, type AiTutorQuestionContext } from '../services/aiTutorContextService';
import { completeAiTutorQuota, releaseAiTutorQuota, reserveAiTutorQuota } from '../services/aiTutorQuota';

const MODEL = 'gemini-2.0-flash';

const error = (code: string, message: string, status: number, requestId: string): Response => jsonResponse({
  status: 'error',
  error: { code, message, requestId },
}, status);

const buildPrompt = (questions: AiTutorQuestionContext[]): string => {
  const context = questions.map((item, index) => ({
    number: index + 1,
    question: item.question,
    options: item.options,
    correctAnswer: item.correctAnswer,
  }));
  return [
    'Bạn là Bác sĩ Cú Mèo, gia sư tiểu học tiếng Việt.',
    'Phân tích lỗ hổng kiến thức ngắn gọn, giải thích dễ hiểu và tạo 2 hoặc 3 câu trắc nghiệm mới.',
    'Mỗi câu thực hành phải có đúng 4 lựa chọn và correctAnswer phải trùng chính xác một lựa chọn.',
    'Chỉ trả về JSON gồm diagnosis, explanation, practiceQuestions. Không thêm markdown.',
    `Ngữ cảnh câu sai: ${JSON.stringify(context)}`,
  ].join('\n');
};

const parseProviderJson = (value: string): unknown => {
  const cleaned = value.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
  try {
    return JSON.parse(cleaned);
  } catch {
    const object = cleaned.match(/\{[\s\S]*\}/)?.[0];
    if (!object) return null;
    try { return JSON.parse(object); } catch { return null; }
  }
};

export async function handleAiTutorRoutes(
  request: Request,
  env: Env,
  path: string,
  method: string,
): Promise<Response | null> {
  if (path !== '/api/ai-tutor/diagnose' || method !== 'POST') return null;

  const requestId = request.headers.get('x-request-id') || crypto.randomUUID();
  const startedAt = Date.now();
  const authResult = await verifyJWTMiddleware(request, env);
  if (authResult instanceof Response) return authResult;
  const user = authResult.user;
  let reserved = false;

  try {
    const parsedRequest = AiTutorDiagnoseRequestSchema.safeParse(await request.json());
    if (!parsedRequest.success) return error('INVALID_REQUEST', 'Yêu cầu chẩn đoán không hợp lệ.', 400, requestId);

    const result = await loadAuthorizedAiTutorResult(env.DB, user, parsedRequest.data.resultId);
    if (!result) return error('RESULT_NOT_FOUND', 'Không tìm thấy bài làm.', 404, requestId);

    const quota = await reserveAiTutorQuota(env.DB, {
      requestId,
      username: user.username,
      role: user.role,
      resultId: parsedRequest.data.resultId,
    });
    if (!quota.allowed) return error('AI_TUTOR_QUOTA_EXCEEDED', 'Đã hết lượt trợ giúp AI hôm nay.', 429, requestId);
    reserved = !quota.reused;

    const wrongQuestions = await loadAiTutorWrongQuestionContext(env.DB, result);
    if (wrongQuestions.length === 0) {
      if (reserved) await releaseAiTutorQuota(env.DB, requestId);
      return error('NO_WRONG_QUESTIONS', 'Bài làm không có câu sai phù hợp để chẩn đoán.', 422, requestId);
    }

    const upstream = await env.AI_GATEWAY.fetch(`${env.CLIPROXY_API}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.CLIPROXY_TOKEN}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: buildPrompt(wrongQuestions) }],
        temperature: 0.5,
        max_tokens: 1800,
        response_format: { type: 'json_object' },
      }),
    });
    if (!upstream.ok) {
      if (reserved) await releaseAiTutorQuota(env.DB, requestId);
      console.error(JSON.stringify({ event: 'ai_tutor_failed', requestId, role: user.role, model: MODEL, status: upstream.status, latencyMs: Date.now() - startedAt }));
      return error('AI_SERVICE_UNAVAILABLE', 'Dịch vụ trợ giảng tạm thời chưa sẵn sàng.', 503, requestId);
    }

    const providerEnvelope = await upstream.json() as { choices?: Array<{ message?: { content?: string } }> };
    const providerOutput = AiTutorProviderOutputSchema.safeParse(parseProviderJson(providerEnvelope.choices?.[0]?.message?.content || ''));
    if (!providerOutput.success) {
      if (reserved) await releaseAiTutorQuota(env.DB, requestId);
      console.error(JSON.stringify({ event: 'ai_tutor_invalid_output', requestId, role: user.role, model: MODEL, status: 502, latencyMs: Date.now() - startedAt }));
      return error('AI_INVALID_OUTPUT', 'Dịch vụ trợ giảng trả về nội dung chưa hợp lệ.', 502, requestId);
    }

    await completeAiTutorQuota(env.DB, requestId);
    const data = {
      diagnosis: providerOutput.data.diagnosis,
      explanation: providerOutput.data.explanation,
      practiceQuestions: providerOutput.data.practiceQuestions.map((question, index) => ({
        id: `ai-practice-${requestId}-${index + 1}`,
        ...question,
      })),
      wrongQuestionCount: wrongQuestions.length,
    };
    console.info(JSON.stringify({ event: 'ai_tutor_succeeded', requestId, role: user.role, model: MODEL, status: 200, latencyMs: Date.now() - startedAt }));
    return jsonResponse({ status: 'success', data });
  } catch {
    if (reserved) await releaseAiTutorQuota(env.DB, requestId).catch(() => undefined);
    console.error(JSON.stringify({ event: 'ai_tutor_exception', requestId, role: user.role, model: MODEL, status: 500, latencyMs: Date.now() - startedAt }));
    return error('AI_TUTOR_FAILED', 'Không thể hoàn tất chẩn đoán lúc này.', 500, requestId);
  }
}
