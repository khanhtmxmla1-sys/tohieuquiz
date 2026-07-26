import { Env } from '../types';
import { jsonResponse, errorResponse } from '../utils/response';

export async function handlePracticeRoutes(request: Request, env: Env, path: string, method: string): Promise<Response> {
    const db = env.DB;

    // GET /api/practice/topics - List all unique topics (from tags column)
    if (path === '/api/practice/topics' && method === 'GET') {
        try {
            // Get all tags from questions table that are not empty
            const rows = await db.prepare('SELECT tags FROM questions WHERE tags IS NOT NULL AND tags != ""').all<{ tags: string }>();

            // Because one question could have multiple tags separated by commas or spaces, we need to process them
            const topicMap = new Map<string, number>();

            rows.results.forEach((row: any) => {
                if (row.tags) {
                    // Split by comma or space
                    const tagsArray = row.tags.split(/[\s,]+/);
                    const uniqueTagsInQuestion = new Set<string>();

                    tagsArray.forEach((tag: string) => {
                        const trimmed = tag.trim();
                        // Only add hashtags that start with # and exist
                        if (trimmed && trimmed.startsWith('#')) {
                            uniqueTagsInQuestion.add(trimmed);
                        }
                    });

                    // Update count for each unique tag in this question
                    uniqueTagsInQuestion.forEach(tag => {
                        topicMap.set(tag, (topicMap.get(tag) || 0) + 1);
                    });
                }
            });

            const uniqueTopics = Array.from(topicMap.entries())
                .map(([name, count]) => ({ name, count }))
                .sort((a, b) => a.name.localeCompare(b.name));

            return jsonResponse({ topics: uniqueTopics }, 200, 60);
        } catch (error: any) {
            console.error('[GET /api/practice/topics] Error:', error.message);
            return errorResponse('Failed to fetch practice topics');
        }
    }

    // GET /api/practice - Fetch random questions for a specific topic
    // Expects ?topic=#Phép_Nhân
    if (path === '/api/practice' && method === 'GET') {
        try {
            const url = new URL(request.url);
            let topic = url.searchParams.get('topic');
            let limitParam = url.searchParams.get('limit') || '10';
            const limit = Math.min(parseInt(limitParam, 10) || 10, 50); // Max 50 questions

            if (!topic) {
                return errorResponse('Missing topic parameter', 400);
            }

            // Decode URI component in case it was encoded (e.g., %23Phép_Nhân)
            topic = decodeURIComponent(topic);

            // Add # prefix if missing
            if (!topic.startsWith('#')) {
                topic = '#' + topic;
            }

            // Using LIKE to match variations, e.g. multiple tags in the same string "#Toan, #Phep_Nhan"
            // We pad with % to allow matching anywhere in the tags string
            const searchPattern = `%${topic}%`;

            const rows = await db.prepare(
                'SELECT id, quiz_id, type, question, options, correct_answer, items, text_field, blanks, distractors, sentence, words, correct_word_indexes, image, tags FROM questions WHERE tags LIKE ? ORDER BY RANDOM() LIMIT ?'
            ).bind(searchPattern, limit).all<import('../types').Question>();

            // Map D1 snake_case and JSON string fields to frontend camelCase objects
            const mappedQuestions = rows.results.map((q: any) => {
                let parsed = { ...q };
                if (typeof q.items === 'string') try { parsed.items = JSON.parse(q.items); } catch { }
                if (typeof q.pairs === 'string') try { parsed.pairs = JSON.parse(q.pairs); } catch { }
                if (typeof q.categories === 'string') try { parsed.categories = JSON.parse(q.categories); } catch { }
                if (typeof q.blanks === 'string') try { parsed.blanks = JSON.parse(q.blanks); } catch { }
                if (typeof q.distractors === 'string') try { parsed.distractors = JSON.parse(q.distractors); } catch { }
                if (typeof q.options === 'string') parsed.options = q.options.split('|');
                if (typeof q.correctAnswers === 'string') try { parsed.correctAnswers = JSON.parse(q.correctAnswers); } catch { }
                if (typeof q.letters === 'string') try { parsed.letters = JSON.parse(q.letters); } catch { }
                if (typeof q.riddleLines === 'string') try { parsed.riddleLines = JSON.parse(q.riddleLines); } catch { }
                if (typeof q.words === 'string') try { parsed.words = JSON.parse(q.words); } catch { }
                if (typeof q.correctWordIndexes === 'string') try { parsed.correctWordIndexes = JSON.parse(q.correctWordIndexes); } catch { }
                if (typeof q.correctOrder === 'string') try { parsed.correctOrder = JSON.parse(q.correctOrder); } catch { }
                if (typeof q.optionImages === 'string') try { parsed.optionImages = JSON.parse(q.optionImages); } catch { }

                // Map legacy/snake_case fields to frontend expected fields
                parsed.quizId = parsed.quiz_id;
                parsed.correctAnswer = parsed.correct_answer;
                parsed.mainQuestion = parsed.question;
                parsed.correctWord = parsed.correct_word;
                parsed.text = parsed.text_field;
                parsed.sentence = parsed.sentence || parsed.text_field || ""; // Found missing mapping
                parsed.explanation = parsed.explanation || "";
                parsed.audio = parsed.audio || "";

                const qType = parsed.type;
                if (qType === 'IMAGE_QUESTION') {
                    parsed.optionImages = parsed.optionImages || parsed.distractors || [];
                } else if (qType === 'UNDERLINE') {
                    // Critical Fix for Underline
                    parsed.words = parsed.words || parsed.items || [];
                    if (parsed.words.length === 0 && parsed.sentence) {
                        // Fallback: Split sentence into words if words array is empty
                        parsed.words = parsed.sentence.split(/\s+/).filter((w: string) => w.length > 0);
                    }
                    let parsedIndexes = [];
                    try {
                        parsedIndexes = typeof parsed.correctAnswer === 'string' ? JSON.parse(parsed.correctAnswer) : (parsed.correctWordIndexes || parsed.correctAnswer);
                    } catch (e) { }
                    parsed.correctWordIndexes = Array.isArray(parsedIndexes) ? parsedIndexes : [];
                } else if (qType === 'MATCHING') {
                    // Critical Fix for Matching
                    parsed.pairs = parsed.pairs || parsed.items || [];
                    // Ensure pairs is an array of objects {left, right}
                    if (Array.isArray(parsed.pairs) && parsed.pairs.length > 0 && typeof parsed.pairs[0] === 'string') {
                        // Sometimes items is a flat mixed array, but QuestionRenderer expects objects
                        // This usually shouldn't happen with modern schema but good to have
                    }
                } else if (qType === 'RIDDLE') {
                    parsed.riddleLines = parsed.riddleLines || parsed.items || [];
                    parsed.answerLabel = parsed.answerLabel || parsed.text || '';
                    parsed.hint = parsed.hint || parsed.sentence || '';
                } else if (qType === 'CATEGORIZATION') {
                    parsed.categories = parsed.categories || parsed.distractors || [];
                    parsed.items = parsed.items || [];
                } else if (qType === 'WORD_SCRAMBLE') {
                    parsed.letters = parsed.letters || parsed.items || [];
                }

                return parsed;
            });

            // Construct a virtual quiz payload required by TakeQuizUI (it expects full quiz + questions)
            const virtualQuiz = {
                id: `practice_${new Date().getTime()}`,
                title: `Ôn tập: ${topic.replace('#', '').replace(/_/g, ' ')}`,
                classLevel: 'Tự do',
                category: 'Luyện tập',
                timeLimit: 0, // No time limit for practice
                isPractice: true, // Flag for frontend logic
                createdAt: new Date().toISOString(),
                questions: mappedQuestions
            };

            return jsonResponse(virtualQuiz);
        } catch (error: any) {
            console.error('[GET /api/practice] Error:', error.message);
            return errorResponse('Failed to fetch practice quiz');
        }
    }

    return errorResponse('Not found: ' + path, 404);
}
