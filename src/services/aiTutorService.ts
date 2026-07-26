/**
 * AI Tutor Service
 * 
 * Provides AI-powered explanations for wrong answers,
 * suggests similar practice questions, and analyzes weaknesses.
 * 
 * Uses LLM-Mux (OpenAI-compatible API) for AI calls.
 */

import { Question } from '../types';
import { requestWorkerAiText } from './ai/workerAiClient';
import { isSkippedAnswer } from '../features/results/studentResultSummary';

// Call AI via the JWT-authenticated Worker proxy.
async function callLLM(prompt: string): Promise<string> {
    return requestWorkerAiText({
        model: 'gemini-2.5-flash',
        messages: [
            {
                role: 'system',
                content: 'Bạn là một gia sư AI thân thiện cho học sinh tiểu học Việt Nam. Trả lời bằng tiếng Việt rõ ràng, ấm áp; chỉ dùng emoji khi thực sự cần.',
            },
            { role: 'user', content: prompt },
        ],
        temperature: 0.7,
    });
}

export interface ExplanationResult {
    explanation: string;
    tip: string;
    isLoading?: boolean;
    error?: string;
}

export interface SimilarQuestion {
    question: string;
    options: string[];
    correctAnswer: string;
    explanation: string;
}

export interface WeaknessAnalysis {
    weakTopics: string[];
    suggestions: string[];
    overallFeedback: string;
}

/**
 * Get AI explanation for why an answer is wrong
 */
export async function explainAnswer(
    question: Question,
    userAnswer: string,
    correctAnswer: string
): Promise<ExplanationResult> {
    try {
        const q = question as any;
        const questionText = q.question || q.mainQuestion || '';
        const optionsText = q.options ? `Các đáp án:\n${q.options.map((opt: string, i: number) => `${String.fromCharCode(65 + i)}. ${opt}`).join('\n')}` : '';

        const prompt = `Học sinh đã trả lời SAI câu hỏi sau:

📝 Câu hỏi: ${questionText}
${optionsText}

❌ Học sinh chọn: ${userAnswer}
✅ Đáp án đúng: ${correctAnswer}

Hãy giải thích CHI TIẾT và DỄ HIỂU cho học sinh tiểu học:

QUY TẮC FORMAT (RẤT QUAN TRỌNG):
- KHÔNG dùng Markdown headers (###, ##, #)
- KHÔNG dùng ký tự "x x" hay escape sequences
- Mỗi ý chính gạch đầu dòng bằng số: "1.", "2.", "3."
- Phân số viết dạng: 1/2, 3/5, 7/10 (sẽ được render đẹp)
- Dùng emoji để sinh động: ✅ ❌ 💡 📝 🎯
- Xuống dòng giữa các ý để dễ đọc

NỘI DUNG CẦN GIẢI THÍCH:
1. Tại sao đáp án đúng là "${correctAnswer}"
2. Tại sao đáp án "${userAnswer}" không đúng  
3. Cách nhận biết đáp án đúng

Trả lời JSON (explanation phải có bullet points rõ ràng):
{
  "explanation": "1. Đáp án đúng là ... vì ...\\n\\n2. Đáp án ... không đúng vì ...\\n\\n3. Cách nhận biết: ...",
  "tip": "Mẹo nhớ ngắn gọn..."
}`;

        const text = await callLLM(prompt);

        // Parse JSON from response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            return {
                explanation: parsed.explanation || 'Không có giải thích.',
                tip: parsed.tip || '',
            };
        }

        // Fallback if JSON parsing fails
        return {
            explanation: text,
            tip: '',
        };
    } catch (error: unknown) {
        const normalizedError = error instanceof Error ? error : new Error(String(error));
        console.error('[AI Tutor] Error explaining answer:', error);
        return {
            explanation: '',
            tip: '',
            error: normalizedError.message || 'Không thể lấy giải thích từ AI.',
        };
    }
}

/**
 * Generate similar practice questions
 */
export async function suggestSimilarQuestions(
    question: Question,
    count: number = 2
): Promise<SimilarQuestion[]> {
    try {
        const q = question as any;
        const questionText = q.question || q.mainQuestion || '';
        const optionsCount = q.options ? q.options.length : 0;

        const prompt = `Dựa trên câu hỏi sau, hãy tạo ${count} câu hỏi TƯƠNG TỰ để học sinh luyện tập:

📝 Câu hỏi gốc: ${questionText}
${optionsCount > 0 ? `Loại: Trắc nghiệm với ${optionsCount} đáp án` : 'Loại: Tự luận ngắn'}

Yêu cầu:
- Câu hỏi cùng chủ đề, cùng dạng nhưng khác số liệu/nội dung
- Phù hợp với học sinh tiểu học
- Có đáp án đúng và giải thích ngắn

Trả lời bằng JSON:
{
  "questions": [
    {
      "question": "Nội dung câu hỏi",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": "A",
      "explanation": "Giải thích ngắn"
    }
  ]
}`;

        const text = await callLLM(prompt);

        // Parse JSON from response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            return parsed.questions || [];
        }

        return [];
    } catch (error: unknown) {
        console.error('[AI Tutor] Error generating similar questions:', error);
        return [];
    }
}

/**
 * Analyze student weaknesses based on wrong answers
 */
export async function analyzeWeaknesses(
    wrongQuestions: Array<{ question: Question; userAnswer: string; correctAnswer: string }>
): Promise<WeaknessAnalysis> {
    if (wrongQuestions.length === 0) {
        return {
            weakTopics: [],
            suggestions: [],
            overallFeedback: '🎉 Xuất sắc! Em đã trả lời đúng tất cả các câu hỏi!',
        };
    }

    try {
        const questionsText = wrongQuestions.map((wq, i) => {
            const q = wq.question as any;
            const qText = q.question || q.mainQuestion || '';
            return `${i + 1}. ${qText}\n   Sai: ${wq.userAnswer} | Đúng: ${wq.correctAnswer}`;
        }).join('\n');

        const prompt = `Học sinh đã trả lời SAI ${wrongQuestions.length} câu sau:

${questionsText}

Hãy phân tích:
1. Những chủ đề/dạng bài nào học sinh còn yếu?
2. Gợi ý cách cải thiện?
3. Một lời nhận xét tổng quan (khích lệ, động viên)

JSON:
{
  "weakTopics": ["Chủ đề 1", "Chủ đề 2"],
  "suggestions": ["Gợi ý 1", "Gợi ý 2"],
  "overallFeedback": "Nhận xét tổng quan..."
}`;

        const text = await callLLM(prompt);

        // Parse JSON from response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            return {
                weakTopics: parsed.weakTopics || [],
                suggestions: parsed.suggestions || [],
                overallFeedback: parsed.overallFeedback || 'Cố gắng lên em nhé! 💪',
            };
        }

        return {
            weakTopics: [],
            suggestions: [],
            overallFeedback: 'Cố gắng lên em nhé! 💪',
        };
    } catch (error: unknown) {
        console.error('[AI Tutor] Error analyzing weaknesses:', error);
        return {
            weakTopics: [],
            suggestions: [],
            overallFeedback: 'Không thể phân tích. Vui lòng thử lại sau.',
        };
    }
}

// ============================================
// Additional exports for RecommendationsTab
// ============================================

export interface AIRecommendation {
    analysis: string;
    weakTopics: string[];
    studyTips: string[];
    encouragement: string;
}

export interface WrongAnswer {
    questionNumber: number;
    questionText: string;
    questionType: string;
    userAnswer: string;
    correctAnswer: string;
}

/**
 * Extract wrong answers from quiz results
 */
export function extractWrongAnswers(quiz: any, answers: Record<string, any>, result?: any): WrongAnswer[] {
    const wrongAnswers: WrongAnswer[] = [];

    quiz.questions.forEach((q: any, idx: number) => {
        const storedAnswer = result?.answers?.[q.id];
        const answer = storedAnswer && typeof storedAnswer === 'object' && !Array.isArray(storedAnswer) && 'selectedAnswer' in storedAnswer
            ? storedAnswer.selectedAnswer
            : answers[q.id];
        if (isSkippedAnswer(answer)) return;

        const questionText = q.question || q.mainQuestion || '';
        const vd = result?.validationDetails?.find((d: any) => d.questionId === q.id);

        let isCorrect = false;
        let correctAnswer = '';

        if (vd) {
            isCorrect = vd.isCorrect;
            correctAnswer = vd.correctAnswer || '';
        } else {
            // Fallback for types not handled well by simple check
            if (q.type === 'MCQ' || q.type === 'RIDDLE') {
                isCorrect = String(answer).toLowerCase().trim() === String(q.correctAnswer).toLowerCase().trim();
                correctAnswer = q.correctAnswer || '';
            } else if (q.type === 'SHORT_ANSWER' || q.type === 'FILL_BLANK') {
                const cleanStudent = String(answer || '').trim().replace(/^'/, '').toLowerCase();
                const cleanCorrect = String(q.correctAnswer || '').trim().replace(/^'/, '').toLowerCase();
                isCorrect = cleanStudent === cleanCorrect;
                correctAnswer = q.correctAnswer || '';
            } else if (q.type === 'MULTIPLE_SELECT') {
                const studentAns = (answer as string[]) || [];
                const correctAns = q.correctAnswers || [];
                isCorrect = studentAns.length === correctAns.length && studentAns.every((v: string) => correctAns.includes(v));
                correctAnswer = (q.correctAnswers || []).join(', ');
            } else if (q.type === 'TRUE_FALSE') {
                const items = q.items || [];
                isCorrect = items.every((item: any, i: number) => {
                    const itemKey = item.id || `item-${i}`;
                    return answer?.[itemKey] === item.isCorrect;
                });
                correctAnswer = 'Xem chi tiết';
            } else {
                isCorrect = !!answer;
                correctAnswer = q.correctAnswer || 'N/A';
            }
        }

        if (!isCorrect) {
            wrongAnswers.push({
                questionNumber: idx + 1,
                questionText: questionText,
                questionType: q.type || 'MCQ',
                userAnswer: String(answer || 'Không trả lời'),
                correctAnswer: correctAnswer,
            });
        }
    });

    return wrongAnswers;
}

/**
 * Get AI-powered recommendations based on quiz results
 */
export async function getAIRecommendations(
    quiz: any,
    result: any,
    wrongAnswers: WrongAnswer[]
): Promise<AIRecommendation> {
    if (wrongAnswers.length === 0) {
        return {
            analysis: 'Xuất sắc! Em đã trả lời đúng tất cả các câu hỏi!',
            weakTopics: [],
            studyTips: [],
            encouragement: 'Thầy cô rất tự hào về em. Hãy tiếp tục phát huy nhé!',
        };
    }

    try {
        const wrongQuestionsText = wrongAnswers.map((wq, i) =>
            `${i + 1}. [${wq.questionType}] ${wq.questionText}\n   Em chọn: ${wq.userAnswer} | Đáp án: ${wq.correctAnswer}`
        ).join('\n');

        const prompt = `Bạn là một gia sư AI thân thiện cho học sinh tiểu học Việt Nam.

Học sinh vừa hoàn thành bài kiểm tra "${quiz.title || 'Bài kiểm tra'}" với kết quả:
- Số câu đúng: ${result.correctCount}/${result.totalQuestions}
- Điểm: ${result.score}/10
- Độ chính xác: ${result.totalQuestions > 0 ? Math.round((result.correctCount / result.totalQuestions) * 100) : 0}%

Các câu trả lời SAI:
${wrongQuestionsText}

Hãy phân tích và đưa ra gợi ý:
1. Nhận xét tổng quan về bài làm (2-3 câu)
2. Các chủ đề/dạng bài em còn yếu (liệt kê ngắn gọn)
3. 3-4 gợi ý cụ thể để cải thiện
4. Một lời động viên, khích lệ (ấm áp, thân thiện)

Trả lời bằng JSON:
{
  "analysis": "Nhận xét tổng quan...",
  "weakTopics": ["Chủ đề 1", "Chủ đề 2"],
  "studyTips": ["Gợi ý 1", "Gợi ý 2", "Gợi ý 3"],
  "encouragement": "Lời động viên..."
}`;

        const text = await callLLM(prompt);

        // Parse JSON from response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            return {
                analysis: parsed.analysis || 'Cần cố gắng hơn nữa em nhé!',
                weakTopics: parsed.weakTopics || [],
                studyTips: parsed.studyTips || [],
                encouragement: parsed.encouragement || 'Cố gắng lên em nhé! 💪',
            };
        }

        return {
            analysis: 'Cần cố gắng hơn nữa em nhé!',
            weakTopics: [],
            studyTips: [],
            encouragement: 'Cố gắng lên em nhé! 💪',
        };
    } catch (error: unknown) {
        console.error('[AI Tutor] Error getting recommendations:', error);
        throw error;
    }
}

