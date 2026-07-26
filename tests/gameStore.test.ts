import { beforeEach, describe, expect, it } from 'vitest';

import { useGameStore } from '../src/stores/useGameStore';

const HIGH_SCORE_KEY = 'bee_game_highscore';

function resetStore(): void {
    localStorage.clear();
    useGameStore.setState({ state: 'MENU', score: 0, lives: 3, highScore: 0 });
}

describe('useGameStore', () => {
    beforeEach(() => {
        resetStore();
    });

    it('starts a run with a full set of lives and a cleared score', () => {
        useGameStore.setState({ score: 42, lives: 1 });

        useGameStore.getState().startGame();

        const { state, score, lives } = useGameStore.getState();
        expect(state).toBe('PLAYING');
        expect(score).toBe(0);
        expect(lives).toBe(3);
    });

    it('endGame finishes the run without consuming a life and persists the high score', () => {
        useGameStore.getState().startGame();
        useGameStore.getState().addScore(70);

        useGameStore.getState().endGame();

        const { state, lives, score, highScore } = useGameStore.getState();
        expect(state).toBe('GAME_OVER');
        // Completing every question must not cost a life — this is the regression that
        // the previous `loseLife()` workaround introduced.
        expect(lives).toBe(3);
        expect(score).toBe(70);
        expect(highScore).toBe(70);
        expect(localStorage.getItem(HIGH_SCORE_KEY)).toBe('70');
    });

    it('endGame keeps a previous higher score', () => {
        useGameStore.setState({ state: 'PLAYING', score: 10, lives: 3, highScore: 90 });

        useGameStore.getState().endGame();

        expect(useGameStore.getState().highScore).toBe(90);
        expect(localStorage.getItem(HIGH_SCORE_KEY)).toBe('90');
    });

    it('loseLife only ends the run once every life is gone', () => {
        useGameStore.getState().startGame();
        useGameStore.getState().addScore(30);

        useGameStore.getState().loseLife();
        expect(useGameStore.getState()).toMatchObject({ state: 'PLAYING', lives: 2 });

        useGameStore.getState().loseLife();
        expect(useGameStore.getState()).toMatchObject({ state: 'PLAYING', lives: 1 });

        useGameStore.getState().loseLife();
        const { state, lives, highScore } = useGameStore.getState();
        expect(state).toBe('GAME_OVER');
        expect(lives).toBe(0);
        expect(highScore).toBe(30);
    });

    it('resetGame returns to the menu and restores lives', () => {
        useGameStore.setState({ state: 'GAME_OVER', score: 55, lives: 0, highScore: 55 });

        useGameStore.getState().resetGame();

        const { state, score, lives, highScore } = useGameStore.getState();
        expect(state).toBe('MENU');
        expect(score).toBe(0);
        expect(lives).toBe(3);
        // Resetting must not wipe the high score.
        expect(highScore).toBe(55);
    });

    it('pause and resume toggle without touching score or lives', () => {
        useGameStore.getState().startGame();
        useGameStore.getState().addScore(20);

        useGameStore.getState().pauseGame();
        expect(useGameStore.getState().state).toBe('PAUSED');

        useGameStore.getState().resumeGame();
        const { state, score, lives } = useGameStore.getState();
        expect(state).toBe('PLAYING');
        expect(score).toBe(20);
        expect(lives).toBe(3);
    });
});
