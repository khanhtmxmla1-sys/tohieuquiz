import type { QuizAiSource } from '../../../shared/teacher-ai-credentials.contract';
import { corsHeaders } from '../middleware/cors';
import { requireTeacher, verifyJWTMiddleware } from '../middleware/jwtAuth';
import { rateLimit } from '../middleware/rateLimit';
import {
    AiRequestPolicyError,
    authorizeAiStage,
    parseAiRequestMeta,
    recordAiStageSuccess,
    recordReservedAiStageSuccess,
    releaseAiStage,
    reserveAiStage,
    type AiRequestMeta,
    type AiStage,
} from '../services/aiRequestPolicy';
import {
    AiPersonalDispatchError,
    dispatchPersonalAi,
} from '../services/aiCredentials/dispatch';
import {
    AiCredentialServiceError,
    resolvePersonalAiCredential,
} from '../services/aiCredentials/service';
import {
    AiQuotaError,
    failAiAction,
    reserveAiAction,
    succeedAiAction,
    type AiActionBinding,
} from '../services/teacherAiQuotaLedger';
import { Env } from '../types';
import { errorResponse, jsonResponse } from '../utils/response';
import { logStructured } from '../utils/logger';

const ALLOWED_MODELS = new Set([
    'gemini-2.0-flash',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-3-flash-preview',
    'gemini-3-pro-preview',
    'gemini-3-pro-image-preview',
    'gpt-4o',
    'sonar',
]);

const PERSONAL_SOURCES = new Set<QuizAiSource>(['gemini-personal', 'deepseek-personal']);
const PERSONAL_STAGES = new Set<AiStage>(['GENERATE', 'REVIEW', 'REPAIR', 'REGENERATE']);
const QUOTA_COMPLETION_STAGES = new Set<AiStage>(['GENERATE', 'REGENERATE', 'GENERIC']);
const QUOTA_RELEASE_STAGES = new Set<AiStage>(['OCR', 'GENERATE', 'REGENERATE', 'GENERIC']);

const codedErrorResponse = (code: string, message: string, status: number): Response => {
    const response = jsonResponse({
        status: 'error',
        code,
        message,
    }, status);
    const headers = new Headers(response.headers);
    headers.set('Cache-Control', 'no-store');
    return new Response(response.body, { status: response.status, headers });
};

const getClientRateLimitPart = (request: Request): string => (
    request.headers.get('CF-Connecting-IP')?.trim() || 'unknown'
);

const shouldReleaseQuota = (meta: AiRequestMeta): boolean => QUOTA_RELEASE_STAGES.has(meta.stage);

const releaseFailedAction = async (
    env: Env,
    meta: AiRequestMeta,
    username: string,
    failureCode: string,
): Promise<void> => {
    if (!shouldReleaseQuota(meta)) return;
    await failAiAction(env.DB, meta.actionId, username, failureCode);
};

const policyErrorResponse = (error: AiRequestPolicyError): Response => {
    const status = error.code === 'AI_STAGE_CONFLICT' ? 409 : 400;
    return codedErrorResponse(error.code, error.message, status);
};

const quotaErrorResponse = (error: AiQuotaError): Response => {
    const status = error.code === 'AI_DAILY_LIMIT_REACHED' ? 429 : 409;
    return codedErrorResponse(error.code, error.message, status);
};

const personalServiceErrorResponse = (error: AiCredentialServiceError): Response => {
    const statuses: Record<AiCredentialServiceError['code'], number> = {
        AI_KEY_MISSING: 404,
        AI_KEY_VERSION_CONFLICT: 409,
        AI_BYOK_DISABLED: 403,
        AI_VAULT_UNAVAILABLE: 503,
    };
    const messages: Record<AiCredentialServiceError['code'], string> = {
        AI_KEY_MISSING: 'Chưa có API key đã lưu cho nguồn AI cá nhân này.',
        AI_KEY_VERSION_CONFLICT: 'API key đã thay đổi trong khi thao tác AI đang chạy.',
        AI_BYOK_DISABLED: 'Nguồn AI cá nhân hiện chưa được bật cho tài khoản này.',
        AI_VAULT_UNAVAILABLE: 'Kho khóa AI tạm thời không khả dụng.',
    };
    return codedErrorResponse(error.code, messages[error.code], statuses[error.code]);
};

const personalDispatchErrorResponse = (error: AiPersonalDispatchError): Response => {
    const statuses: Record<AiPersonalDispatchError['code'], number> = {
        AI_KEY_INVALID: 400,
        AI_PROVIDER_ACCOUNT_REQUIRED: 402,
        AI_PROVIDER_QUOTA: 429,
        AI_PROVIDER_REQUEST_REJECTED: 502,
        AI_PROVIDER_UNAVAILABLE: 503,
        AI_PROVIDER_TIMEOUT: 504,
        AI_PROVIDER_RESPONSE_INVALID: 502,
        AI_CAPABILITY_UNSUPPORTED: 400,
    };
    return codedErrorResponse(error.code, error.message, statuses[error.code]);
};

const parseSource = (raw: unknown): QuizAiSource | null => {
    if (raw === undefined || raw === null || raw === '') return 'system';
    if (raw === 'system' || raw === 'gemini-personal' || raw === 'deepseek-personal') {
        return raw;
    }
    return null;
};

const sha256Hex = async (value: string): Promise<string> => {
    const digest = new Uint8Array(await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(value),
    ));
    return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
};

const applyPersonalRateLimit = async (
    request: Request,
    env: Env,
    username: string,
): Promise<Response | null> => {
    const ownerHash = await sha256Hex(username);
    return rateLimit(request, env, {
        windowMs: 60 * 1000,
        maxRequests: 10,
        failureMode: 'closed',
        keyGenerator: () => `ratelimit:ai:byok:account:${ownerHash}`,
    });
};

const logStageCompleted = (meta: AiRequestMeta): void => {
    if (!meta.promptVersion) return;
    logStructured('info', {
        event: 'ai_stage_completed',
        requestId: meta.actionId,
        context: JSON.stringify({
            workflow: meta.workflow,
            stage: meta.stage,
            promptVersion: meta.promptVersion,
            blueprintVersion: meta.blueprintVersion,
            slotCount: meta.slotCount,
        }),
    });
};

type ExistingPersonalBinding = {
    source: QuizAiSource | null;
    credential_version: number | null;
    ai_model: string | null;
};

const readExistingPersonalBinding = async (
    env: Env,
    username: string,
    actionId: string,
): Promise<ExistingPersonalBinding | null> => env.DB.prepare(`
    SELECT source, credential_version, ai_model
    FROM ai_generation_actions
    WHERE action_id = ?
      AND username = ?
    LIMIT 1
`).bind(actionId, username).first<ExistingPersonalBinding>();

const personalSuccessResponse = (
    request: Request,
    env: Env,
    text: string,
): Response => {
    const response = jsonResponse({
        choices: [{ message: { content: text } }],
    });
    const headers = new Headers(response.headers);
    headers.set('Cache-Control', 'no-store');
    for (const [key, value] of Object.entries(corsHeaders(request, env))) {
        headers.set(key, value);
    }
    return new Response(response.body, {
        status: 200,
        headers,
    });
};

export async function handleAiProxy(
    request: Request,
    env: Env,
    path: string,
    method: string,
): Promise<Response | null> {
    if (path !== '/api/ai/chat' || method !== 'POST') return null;

    const authResult = await verifyJWTMiddleware(request, env);
    if (authResult instanceof Response) return authResult;
    if (!requireTeacher(authResult.user)) {
        return codedErrorResponse('AI_ROLE_FORBIDDEN', 'Tài khoản không có quyền sử dụng chức năng AI này.', 403);
    }

    const role = authResult.user.role === 'admin' ? 'admin' : 'teacher';
    const rateLimitResponse = await rateLimit(request, env, {
        windowMs: 60 * 1000,
        maxRequests: 10,
        failureMode: 'closed',
        keyGenerator: (rateLimitedRequest) => {
            const requestPath = new URL(rateLimitedRequest.url).pathname;
            return `ratelimit:ai:${role}:${requestPath}:${getClientRateLimitPart(rateLimitedRequest)}`;
        },
    });
    if (rateLimitResponse) return rateLimitResponse;

    let body: Record<string, unknown>;
    try {
        body = await request.json() as Record<string, unknown>;
    } catch {
        return codedErrorResponse('AI_REQUEST_INVALID', 'Dữ liệu yêu cầu AI không hợp lệ.', 400);
    }

    const source = parseSource(body.source);
    if (!source) {
        return codedErrorResponse(
            'AI_CAPABILITY_UNSUPPORTED',
            'Nguồn AI được yêu cầu không được hỗ trợ.',
            400,
        );
    }

    const model = typeof body.model === 'string' ? body.model.trim() : '';
    if (!ALLOWED_MODELS.has(model)) {
        return source === 'system'
            ? errorResponse('AI model is not allowed', 400)
            : codedErrorResponse(
                'AI_CAPABILITY_UNSUPPORTED',
                'Nguồn AI cá nhân không chấp nhận model do trình duyệt tự chọn.',
                400,
            );
    }
    if (!Array.isArray(body.messages) || body.messages.length === 0 || body.messages.length > 100) {
        return source === 'system'
            ? errorResponse('Invalid AI messages payload', 400)
            : codedErrorResponse(
                'AI_CAPABILITY_UNSUPPORTED',
                'Nguồn AI cá nhân chỉ hỗ trợ nội dung văn bản hợp lệ.',
                400,
            );
    }

    const serializedLength = JSON.stringify(body).length;
    if (serializedLength > 12 * 1024 * 1024) return errorResponse('AI request is too large', 413);

    let meta: AiRequestMeta;
    try {
        meta = parseAiRequestMeta(body._meta);
    } catch (error) {
        if (error instanceof AiRequestPolicyError) return policyErrorResponse(error);
        return codedErrorResponse('AI_META_INVALID', 'Thông tin định danh thao tác AI không hợp lệ.', 400);
    }

    if (source === 'system') {
        if (!env.AI_GATEWAY || !env.CLIPROXY_API || !env.CLIPROXY_TOKEN) {
            return errorResponse('AI service not configured', 503);
        }

        try {
            await reserveAiAction(env.DB, {
                actionId: meta.actionId,
                username: authResult.user.username,
                role,
                workflow: meta.workflow,
            });
            await authorizeAiStage(env.DB, authResult.user.username, meta);
        } catch (error) {
            if (error instanceof AiQuotaError) return quotaErrorResponse(error);
            if (error instanceof AiRequestPolicyError) return policyErrorResponse(error);
            console.error('[AI Proxy] Policy storage unavailable');
            return codedErrorResponse('AI_POLICY_UNAVAILABLE', 'Không thể xác minh yêu cầu AI lúc này.', 503);
        }

        const { _meta: _internalMeta, source: _source, ...providerPayload } = body;
        const isImageModel = model.includes('image');
        const upstreamBody = {
            ...providerPayload,
            stream: isImageModel ? false : true,
        };

        let aiResponse: Response;
        try {
            aiResponse = await env.AI_GATEWAY.fetch(`${env.CLIPROXY_API.replace(/\/$/, '')}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${env.CLIPROXY_TOKEN}`,
                },
                body: JSON.stringify(upstreamBody),
            });
        } catch {
            try {
                await releaseFailedAction(env, meta, authResult.user.username, 'UPSTREAM_NETWORK_ERROR');
            } catch {
                console.error('[AI Proxy] Failed to release quota after network error');
            }
            return codedErrorResponse('AI_UPSTREAM_UNAVAILABLE', 'Dịch vụ AI tạm thời không khả dụng.', 503);
        }

        if (!aiResponse.ok) {
            try {
                await releaseFailedAction(
                    env,
                    meta,
                    authResult.user.username,
                    `UPSTREAM_${aiResponse.status}`,
                );
            } catch {
                console.error('[AI Proxy] Failed to release quota after upstream error');
            }
            console.error(`[AI Proxy] Downstream error (${aiResponse.status})`);
            return errorResponse(`AI service error (${aiResponse.status})`, aiResponse.status);
        }

        try {
            await recordAiStageSuccess(env.DB, authResult.user.username, meta);
            if (QUOTA_COMPLETION_STAGES.has(meta.stage)) {
                await succeedAiAction(env.DB, meta.actionId, authResult.user.username);
            }
            logStageCompleted(meta);
        } catch (error) {
            if (error instanceof AiRequestPolicyError) return policyErrorResponse(error);
            console.error('[AI Proxy] Failed to persist successful AI stage');
            return codedErrorResponse('AI_STAGE_PERSIST_FAILED', 'Không thể ghi nhận kết quả AI lúc này.', 503);
        }

        const upstreamType = aiResponse.headers.get('content-type') || '';
        const isSse = upstreamType.includes('text/event-stream');
        return new Response(aiResponse.body, {
            status: 200,
            headers: {
                'Content-Type': isSse ? 'text/event-stream' : (upstreamType || 'application/json'),
                'Cache-Control': 'no-store',
                ...(isSse ? { Connection: 'keep-alive' } : {}),
                ...corsHeaders(request, env),
            },
        });
    }

    if (
        !PERSONAL_SOURCES.has(source)
        || !PERSONAL_STAGES.has(meta.stage)
        || (meta.workflow !== 'QUIZ_CREATE' && meta.workflow !== 'QUESTION_REGENERATE')
        || model.includes('image')
    ) {
        return codedErrorResponse(
            'AI_CAPABILITY_UNSUPPORTED',
            'Nguồn AI cá nhân V1 chỉ hỗ trợ tạo, kiểm tra và sửa đề bằng văn bản.',
            400,
        );
    }

    const personalLimit = await applyPersonalRateLimit(
        request,
        env,
        authResult.user.username,
    );
    if (personalLimit) return personalLimit;

    let existingBinding: ExistingPersonalBinding | null;
    try {
        existingBinding = await readExistingPersonalBinding(
            env,
            authResult.user.username,
            meta.actionId,
        );
    } catch {
        console.error('[AI Proxy] Existing personal action lookup unavailable');
        return codedErrorResponse('AI_POLICY_UNAVAILABLE', 'Không thể xác minh yêu cầu AI lúc này.', 503);
    }

    if (existingBinding && existingBinding.source !== source) {
        return quotaErrorResponse(new AiQuotaError('AI_ACTION_CONFLICT'));
    }

    let credential: Awaited<ReturnType<typeof resolvePersonalAiCredential>>;
    try {
        credential = await resolvePersonalAiCredential(env, {
            owner: authResult.user.username,
            role,
            source,
        });
    } catch (error) {
        if (
            error instanceof AiCredentialServiceError
            && error.code === 'AI_KEY_MISSING'
            && existingBinding
        ) {
            return quotaErrorResponse(new AiQuotaError('AI_ACTION_CONFLICT'));
        }
        if (error instanceof AiCredentialServiceError) {
            return personalServiceErrorResponse(error);
        }
        console.error('[AI Proxy] Personal credential resolution unavailable');
        return codedErrorResponse('AI_VAULT_UNAVAILABLE', 'Kho khóa AI tạm thời không khả dụng.', 503);
    }

    if (
        existingBinding
        && (
            Number(existingBinding.credential_version ?? 0) !== credential.version
            || String(existingBinding.ai_model ?? '') !== credential.model
        )
    ) {
        return quotaErrorResponse(new AiQuotaError('AI_ACTION_CONFLICT'));
    }

    const binding: AiActionBinding = {
        source,
        credentialVersion: credential.version,
        model: credential.model,
    };

    try {
        await reserveAiAction(env.DB, {
            actionId: meta.actionId,
            username: authResult.user.username,
            role,
            workflow: meta.workflow,
            binding,
        });
        await reserveAiStage(env.DB, authResult.user.username, meta, binding);
    } catch (error) {
        if (error instanceof AiQuotaError) return quotaErrorResponse(error);
        if (error instanceof AiRequestPolicyError) return policyErrorResponse(error);
        console.error('[AI Proxy] Personal action reservation unavailable');
        return codedErrorResponse('AI_POLICY_UNAVAILABLE', 'Không thể xác minh yêu cầu AI lúc này.', 503);
    }

    let personalResult: { text: string };
    try {
        personalResult = await dispatchPersonalAi({
            provider: credential.provider,
            key: credential.apiKey,
            model: credential.model,
            messages: body.messages,
            temperature: body.temperature,
            maxTokens: body.max_tokens,
            responseFormat: body.response_format,
            signal: request.signal,
        });
    } catch (error) {
        if (error instanceof AiPersonalDispatchError) {
            const context = [
                `provider=${credential.provider}`,
                `model=${credential.model}`,
                `phase=${error.phase || 'unknown'}`,
                error.upstreamStatus ? `status=${error.upstreamStatus}` : '',
                error.finishReason ? `finish=${error.finishReason}` : '',
            ].filter(Boolean).join(';');
            logStructured('warn', {
                event: 'personal_ai_provider_failure',
                requestId: meta.actionId,
                errorCode: error.code,
                context,
            });
        }
        try {
            await releaseAiStage(env.DB, authResult.user.username, meta, binding);
            await releaseFailedAction(
                env,
                meta,
                authResult.user.username,
                error instanceof AiPersonalDispatchError ? error.code : 'PERSONAL_UPSTREAM_ERROR',
            );
        } catch {
            console.error('[AI Proxy] Failed to release personal AI reservation');
        }
        if (error instanceof AiPersonalDispatchError) {
            return personalDispatchErrorResponse(error);
        }
        return codedErrorResponse('AI_PROVIDER_UNAVAILABLE', 'Nhà cung cấp AI tạm thời không khả dụng.', 503);
    }

    try {
        await recordReservedAiStageSuccess(
            env.DB,
            authResult.user.username,
            meta,
            binding,
        );
        if (QUOTA_COMPLETION_STAGES.has(meta.stage)) {
            await succeedAiAction(env.DB, meta.actionId, authResult.user.username);
        }
        logStageCompleted(meta);
    } catch (error) {
        if (error instanceof AiRequestPolicyError) return policyErrorResponse(error);
        console.error('[AI Proxy] Failed to persist personal AI stage');
        return codedErrorResponse('AI_STAGE_PERSIST_FAILED', 'Không thể ghi nhận kết quả AI lúc này.', 503);
    }

    return personalSuccessResponse(request, env, personalResult.text);
}
