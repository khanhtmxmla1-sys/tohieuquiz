import type { MatchingQuestion } from '../../../types';

export interface WorksheetMatchingRow {
    leftLabel: string;
    left: string;
    rightLabel: string;
    right: string;
}

export interface WorksheetMatchingLayout {
    rows: WorksheetMatchingRow[];
    answerText: string;
}

interface IndexedRightValue {
    sourceIndex: number;
    value: string;
}

const hashSeed = (value: string): number => {
    let hash = 0x811c9dc5;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
};

const nextRandom = (state: { value: number }): number => {
    let x = state.value || 0x9e3779b9;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    state.value = x >>> 0;
    return state.value / 0x100000000;
};

const deterministicShuffle = (values: IndexedRightValue[], seed: string): IndexedRightValue[] => {
    const result = [...values];
    const state = { value: hashSeed(seed) };
    for (let index = result.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(nextRandom(state) * (index + 1));
        [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
    }

    if (result.length > 1 && result.every((item, index) => item.sourceIndex === index)) {
        result.push(result.shift()!);
    }
    return result;
};

export function buildWorksheetMatchingLayout(question: MatchingQuestion): WorksheetMatchingLayout {
    const pairs = question.pairs || [];
    const seed = `${question.id}|${pairs.map(pair => `${pair.left}=>${pair.right}`).join('|')}`;
    const shuffled = deterministicShuffle(
        pairs.map((pair, sourceIndex) => ({ sourceIndex, value: String(pair.right ?? '') })),
        seed,
    );

    const rows = pairs.map((pair, index) => ({
        leftLabel: String(index + 1),
        left: String(pair.left ?? ''),
        rightLabel: String.fromCharCode(65 + index),
        right: shuffled[index]?.value ?? '',
    }));
    const answerText = pairs.map((_, sourceIndex) => {
        const rightIndex = shuffled.findIndex(item => item.sourceIndex === sourceIndex);
        return `${sourceIndex + 1}→${rightIndex >= 0 ? String.fromCharCode(65 + rightIndex) : '?'}`;
    }).join('  ');

    return { rows, answerText };
}
