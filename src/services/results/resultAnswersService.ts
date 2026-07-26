import { callApi } from '../apiAdapter';

export type ResultAnswers = Record<string, any>;

export const normalizeResultAnswers = (raw: unknown): ResultAnswers => {
    if (raw === undefined || raw === null || raw === '') return {};

    let parsed = raw;
    if (typeof raw === 'string') {
        try {
            parsed = JSON.parse(raw);
        } catch {
            return {};
        }
    }

    if (Array.isArray(parsed)) {
        const answers: ResultAnswers = {};
        parsed.forEach((item) => {
            if (item && typeof item === 'object' && 'questionId' in item && item.questionId) {
                answers[String(item.questionId)] = item;
            }
        });
        return answers;
    }

    return parsed && typeof parsed === 'object'
        ? parsed as ResultAnswers
        : {};
};

export const fetchResultAnswers = async (
    resultId: string | number
): Promise<ResultAnswers> => {
    try {
        const data = await callApi<{ answers?: unknown }>('get_result_answers', { resultId });
        const rawAnswers = data?.answers;
        const parsedAnswers = typeof rawAnswers === 'string'
            ? JSON.parse(rawAnswers)
            : rawAnswers;
        return normalizeResultAnswers(parsedAnswers);
    } catch (error) {
        console.error('[fetchResultAnswers] Error:', error);
        return {};
    }
};

export const fetchResultAnswersBulk = async (
    resultIds: Array<string | number>
): Promise<Record<string, ResultAnswers>> => {
    const uniqueIds = Array.from(new Set(resultIds.map(String).filter(Boolean)));
    if (uniqueIds.length === 0) return {};

    try {
        const batches: string[][] = [];
        for (let index = 0; index < uniqueIds.length; index += 200) {
            batches.push(uniqueIds.slice(index, index + 200));
        }

        const responses = await Promise.all(batches.map((batch) => (
            callApi<{ data?: Record<string, unknown> }>(
                'get_result_answers_bulk',
                { resultIds: batch }
            )
        )));
        const rawById = Object.assign(
            {},
            ...responses.map((response) => response?.data ?? {})
        ) as Record<string, unknown>;

        return Object.fromEntries(
            Object.entries(rawById).map(([resultId, rawAnswers]) => [
                resultId,
                normalizeResultAnswers(rawAnswers),
            ])
        );
    } catch (error) {
        console.error('[fetchResultAnswersBulk] Error:', error);
        throw error;
    }
};
