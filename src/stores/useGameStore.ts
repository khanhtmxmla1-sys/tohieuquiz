import { create } from 'zustand';

export type GameState = 'MENU' | 'PLAYING' | 'PAUSED' | 'GAME_OVER';

interface GameStore {
    state: GameState;
    score: number;
    lives: number;
    highScore: number;

    // Actions
    startGame: () => void;
    endGame: () => void;
    pauseGame: () => void;
    resumeGame: () => void;
    resetGame: () => void;
    addScore: (points: number) => void;
    loseLife: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
    state: 'MENU',
    score: 0,
    lives: 3,
    highScore: parseInt(localStorage.getItem('bee_game_highscore') || '0'),

    startGame: () => set({ state: 'PLAYING', score: 0, lives: 3 }),
    endGame: () => set((s) => {
        const newHigh = Math.max(s.score, s.highScore);
        localStorage.setItem('bee_game_highscore', newHigh.toString());
        return { state: 'GAME_OVER', highScore: newHigh };
    }),
    pauseGame: () => set({ state: 'PAUSED' }),
    resumeGame: () => set({ state: 'PLAYING' }),
    resetGame: () => set({ state: 'MENU', score: 0, lives: 3 }),

    addScore: (points) => set((s) => ({ score: s.score + points })),
    loseLife: () => set((s) => {
        const newLives = s.lives - 1;
        if (newLives <= 0) {
            const newHigh = Math.max(s.score, s.highScore);
            localStorage.setItem('bee_game_highscore', newHigh.toString());
            return { lives: 0, state: 'GAME_OVER', highScore: newHigh };
        }
        return { lives: newLives };
    }),
}));
