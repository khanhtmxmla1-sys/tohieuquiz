/**
 * Game Question Bank
 * Bộ câu hỏi cho game "Ong Thợ Tìm Mật"
 */

export interface GameQuestion {
    id: string;
    text: string;
    options: string[];
    correctAnswer: string;
}

export const GAME_QUESTIONS: GameQuestion[] = [
    // === PHÉP CỘNG TRONG PHẠM VI 20 (25 câu) ===
    { id: 'add1', text: '1 + 1 = ?', options: ['1', '2', '3', '4'], correctAnswer: '2' },
    { id: 'add2', text: '2 + 3 = ?', options: ['4', '5', '6', '7'], correctAnswer: '5' },
    { id: 'add3', text: '4 + 5 = ?', options: ['7', '8', '9', '10'], correctAnswer: '9' },
    { id: 'add4', text: '3 + 6 = ?', options: ['7', '8', '9', '10'], correctAnswer: '9' },
    { id: 'add5', text: '7 + 2 = ?', options: ['8', '9', '10', '11'], correctAnswer: '9' },
    { id: 'add6', text: '5 + 5 = ?', options: ['9', '10', '11', '12'], correctAnswer: '10' },
    { id: 'add7', text: '6 + 4 = ?', options: ['8', '9', '10', '11'], correctAnswer: '10' },
    { id: 'add8', text: '8 + 3 = ?', options: ['10', '11', '12', '13'], correctAnswer: '11' },
    { id: 'add9', text: '7 + 5 = ?', options: ['10', '11', '12', '13'], correctAnswer: '12' },
    { id: 'add10', text: '9 + 4 = ?', options: ['11', '12', '13', '14'], correctAnswer: '13' },
    { id: 'add11', text: '8 + 6 = ?', options: ['12', '13', '14', '15'], correctAnswer: '14' },
    { id: 'add12', text: '7 + 8 = ?', options: ['13', '14', '15', '16'], correctAnswer: '15' },
    { id: 'add13', text: '9 + 7 = ?', options: ['14', '15', '16', '17'], correctAnswer: '16' },
    { id: 'add14', text: '8 + 9 = ?', options: ['15', '16', '17', '18'], correctAnswer: '17' },
    { id: 'add15', text: '9 + 9 = ?', options: ['16', '17', '18', '19'], correctAnswer: '18' },
    { id: 'add16', text: '10 + 5 = ?', options: ['13', '14', '15', '16'], correctAnswer: '15' },
    { id: 'add17', text: '11 + 3 = ?', options: ['12', '13', '14', '15'], correctAnswer: '14' },
    { id: 'add18', text: '12 + 4 = ?', options: ['14', '15', '16', '17'], correctAnswer: '16' },
    { id: 'add19', text: '10 + 8 = ?', options: ['16', '17', '18', '19'], correctAnswer: '18' },
    { id: 'add20', text: '11 + 6 = ?', options: ['15', '16', '17', '18'], correctAnswer: '17' },
    { id: 'add21', text: '6 + 7 = ?', options: ['11', '12', '13', '14'], correctAnswer: '13' },
    { id: 'add22', text: '5 + 8 = ?', options: ['11', '12', '13', '14'], correctAnswer: '13' },
    { id: 'add23', text: '4 + 9 = ?', options: ['11', '12', '13', '14'], correctAnswer: '13' },
    { id: 'add24', text: '10 + 10 = ?', options: ['18', '19', '20', '21'], correctAnswer: '20' },
    { id: 'add25', text: '9 + 6 = ?', options: ['13', '14', '15', '16'], correctAnswer: '15' },

    // === PHÉP TRỪ TRONG PHẠM VI 20 (25 câu) ===
    { id: 'sub1', text: '2 - 1 = ?', options: ['0', '1', '2', '3'], correctAnswer: '1' },
    { id: 'sub2', text: '5 - 2 = ?', options: ['2', '3', '4', '5'], correctAnswer: '3' },
    { id: 'sub3', text: '8 - 3 = ?', options: ['4', '5', '6', '7'], correctAnswer: '5' },
    { id: 'sub4', text: '10 - 4 = ?', options: ['5', '6', '7', '8'], correctAnswer: '6' },
    { id: 'sub5', text: '9 - 5 = ?', options: ['3', '4', '5', '6'], correctAnswer: '4' },
    { id: 'sub6', text: '7 - 3 = ?', options: ['3', '4', '5', '6'], correctAnswer: '4' },
    { id: 'sub7', text: '12 - 5 = ?', options: ['6', '7', '8', '9'], correctAnswer: '7' },
    { id: 'sub8', text: '15 - 6 = ?', options: ['7', '8', '9', '10'], correctAnswer: '9' },
    { id: 'sub9', text: '11 - 4 = ?', options: ['6', '7', '8', '9'], correctAnswer: '7' },
    { id: 'sub10', text: '14 - 7 = ?', options: ['6', '7', '8', '9'], correctAnswer: '7' },
    { id: 'sub11', text: '13 - 5 = ?', options: ['6', '7', '8', '9'], correctAnswer: '8' },
    { id: 'sub12', text: '16 - 8 = ?', options: ['6', '7', '8', '9'], correctAnswer: '8' },
    { id: 'sub13', text: '17 - 9 = ?', options: ['6', '7', '8', '9'], correctAnswer: '8' },
    { id: 'sub14', text: '18 - 9 = ?', options: ['7', '8', '9', '10'], correctAnswer: '9' },
    { id: 'sub15', text: '20 - 10 = ?', options: ['8', '9', '10', '11'], correctAnswer: '10' },
    { id: 'sub16', text: '19 - 8 = ?', options: ['9', '10', '11', '12'], correctAnswer: '11' },
    { id: 'sub17', text: '15 - 9 = ?', options: ['4', '5', '6', '7'], correctAnswer: '6' },
    { id: 'sub18', text: '13 - 7 = ?', options: ['4', '5', '6', '7'], correctAnswer: '6' },
    { id: 'sub19', text: '12 - 8 = ?', options: ['3', '4', '5', '6'], correctAnswer: '4' },
    { id: 'sub20', text: '11 - 6 = ?', options: ['4', '5', '6', '7'], correctAnswer: '5' },
    { id: 'sub21', text: '10 - 7 = ?', options: ['2', '3', '4', '5'], correctAnswer: '3' },
    { id: 'sub22', text: '14 - 6 = ?', options: ['6', '7', '8', '9'], correctAnswer: '8' },
    { id: 'sub23', text: '16 - 7 = ?', options: ['7', '8', '9', '10'], correctAnswer: '9' },
    { id: 'sub24', text: '20 - 5 = ?', options: ['13', '14', '15', '16'], correctAnswer: '15' },
    { id: 'sub25', text: '18 - 10 = ?', options: ['6', '7', '8', '9'], correctAnswer: '8' },
];

/**
 * Hàm shuffle (xáo trộn) mảng
 */
export function shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

/**
 * Lấy N câu hỏi ngẫu nhiên
 */
export function getRandomQuestions(count: number = 50): GameQuestion[] {
    const shuffled = shuffleArray(GAME_QUESTIONS);
    return shuffled.slice(0, Math.min(count, shuffled.length));
}
