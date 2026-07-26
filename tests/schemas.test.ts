import { describe, it, expect } from 'vitest';
import {
    MCQQuestionSchema,
    TrueFalseQuestionSchema,
    validateQuiz
} from '../schemas/quiz.schema';

describe('Quiz Schema', () => {
    describe('MCQ Question', () => {
        it('should validate correct MCQ', () => {
            const mcq = {
                id: 'q1',
                type: 'MCQ',
                question: 'What is 2 + 2?',
                options: ['3', '4', '5', '6'],
                correctAnswer: 'B'
            };
            expect(MCQQuestionSchema.safeParse(mcq).success).toBe(true);
        });

        it('should reject MCQ with invalid answer', () => {
            const mcq = {
                id: 'q1',
                type: 'MCQ',
                question: 'Test?',
                options: ['A', 'B'],
                correctAnswer: 'Z'
            };
            expect(MCQQuestionSchema.safeParse(mcq).success).toBe(false);
        });
    });

    describe('True/False Question', () => {
        it('should validate correct True/False', () => {
            const tf = {
                id: 'q2',
                type: 'TRUE_FALSE',
                mainQuestion: 'About water:',
                items: [
                    { id: 'i1', statement: 'Water is blue', isCorrect: false },
                    { id: 'i2', statement: 'Water is H2O', isCorrect: true }
                ]
            };
            expect(TrueFalseQuestionSchema.safeParse(tf).success).toBe(true);
        });
    });

    describe('Full Quiz', () => {
        it('should validate complete quiz', () => {
            const quiz = {
                id: 'quiz-1',
                title: 'Test Quiz',
                classLevel: '3',
                timeLimit: 30,
                createdAt: new Date().toISOString(),
                questions: [{
                    id: 'q1',
                    type: 'MCQ',
                    question: 'Test?',
                    options: ['A', 'B', 'C', 'D'],
                    correctAnswer: 'A'
                }]
            };
            expect(validateQuiz(quiz).success).toBe(true);
        });

        it('should reject quiz without questions', () => {
            const quiz = {
                id: 'quiz-1',
                title: 'Empty Quiz',
                classLevel: '3',
                timeLimit: 30,
                createdAt: new Date().toISOString(),
                questions: []
            };
            expect(validateQuiz(quiz).success).toBe(false);
        });

        it('should reject invalid class level', () => {
            const quiz = {
                id: 'quiz-1',
                title: 'Test',
                classLevel: '6',
                timeLimit: 30,
                createdAt: new Date().toISOString(),
                questions: [{ id: 'q1', type: 'MCQ', question: 'Q?', options: ['A', 'B'], correctAnswer: 'A' }]
            };
            expect(validateQuiz(quiz).success).toBe(false);
        });
    });
});
