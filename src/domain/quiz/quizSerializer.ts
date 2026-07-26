import { QuestionType, type Quiz } from '../../types';

const toSaveString = (value: unknown): string => {
    if (value === undefined || value === null) return '';
    return String(value);
};

export const serializeQuizForSave = (quiz: Quiz): Quiz => {
    const questions = quiz.questions.map((question) => {
        const serialized = { ...question } as any;

        if (serialized.question) {
            serialized.question = toSaveString(serialized.question);
        } else if (serialized.mainQuestion) {
            serialized.question = toSaveString(serialized.mainQuestion);
        }

        if (serialized.correctAnswer) serialized.correctAnswer = toSaveString(serialized.correctAnswer);
        if (serialized.text) serialized.text = toSaveString(serialized.text);
        if (serialized.sentence) serialized.sentence = toSaveString(serialized.sentence);
        if (serialized.difficulty !== undefined && serialized.difficulty !== null) {
            const difficulty = Number(serialized.difficulty);
            serialized.difficulty = difficulty === 1 || difficulty === 2 || difficulty === 3
                ? difficulty
                : undefined;
        }
        if (Array.isArray(serialized.options)) {
            serialized.options = serialized.options.map(toSaveString);
        }

        switch (serialized.type) {
            case QuestionType.RIDDLE:
                if (serialized.riddleLines) serialized.items = serialized.riddleLines;
                if (serialized.answerLabel) serialized.text = toSaveString(serialized.answerLabel);
                if (serialized.hint) serialized.sentence = toSaveString(serialized.hint);
                break;
            case QuestionType.IMAGE_QUESTION:
                if (serialized.optionImages) serialized.distractors = serialized.optionImages;
                break;
            case QuestionType.WORD_SCRAMBLE:
                if (serialized.letters) serialized.items = serialized.letters;
                if (serialized.correctWord) serialized.correctAnswer = toSaveString(serialized.correctWord);
                if (serialized.hint) serialized.text = toSaveString(serialized.hint);
                break;
            case QuestionType.ERROR_CORRECTION:
                if (serialized.passage) serialized.text = toSaveString(serialized.passage);
                if (serialized.wrongWord) serialized.distractors = serialized.wrongWord;
                if (serialized.correctWord) serialized.correctAnswer = toSaveString(serialized.correctWord);
                break;
            case QuestionType.MATCHING:
                if (serialized.pairs) serialized.items = serialized.pairs;
                break;
            case QuestionType.CATEGORIZATION:
                if (serialized.categories) serialized.distractors = serialized.categories;
                break;
            case QuestionType.MULTIPLE_SELECT:
                if (serialized.correctAnswers) serialized.correctAnswer = JSON.stringify(serialized.correctAnswers);
                break;
            case QuestionType.ORDERING:
                if (serialized.correctOrder) serialized.correctAnswer = JSON.stringify(serialized.correctOrder);
                break;
            case QuestionType.UNDERLINE:
                if (serialized.words) serialized.items = serialized.words;
                if (serialized.correctWordIndexes) {
                    serialized.correctAnswer = JSON.stringify(serialized.correctWordIndexes);
                }
                break;
        }

        return serialized;
    });

    return { ...quiz, questions } as Quiz;
};
