import { callApi } from './apiAdapter';
import { Quiz } from '../types';

export const practiceService = {
    /**
     * Fetches the list of all unique topic tags available in the database with their counts
     */
    getTopics: async (): Promise<{ name: string; count: number }[]> => {
        const response = await callApi<{ topics: { name: string; count: number }[] }>(
            'get_practice_topics',
        );
        return response.topics || [];
    },

    /**
     * Fetches a dynamically generated practice quiz for a given topic
     */
    getPracticeQuiz: async (topic: string, limit: number = 10): Promise<Quiz | null> => {
        try {
            const response = await callApi<Quiz>('get_practice_quiz', { topic, limit });
            return response;
        } catch (error) {
            console.error('Error fetching practice quiz:', error);
            return null;
        }
    }
};

