import { describe, expect, it } from 'vitest';
import {
  updateMatchingAnswer,
  updateOrderingRanks,
} from '../src/features/quiz-player/utils/structuredAnswerUpdates';

describe('structured answer updates', () => {
  it('moves a matching target from its old left item to the newly selected left item', () => {
    expect(updateMatchingAnswer({
      'l-0': 'r-0',
      selectedLeft: 'l-1',
      __shuffledIds: ['r-0', 'r-1'],
    }, 'r-0', 'right')).toEqual({
      'l-1': 'r-0',
      __shuffledIds: ['r-0', 'r-1'],
    });
  });

  it('toggles the selected left item without changing existing pairs', () => {
    expect(updateMatchingAnswer({ 'l-0': 'r-0' }, 'l-1', 'left')).toEqual({
      'l-0': 'r-0',
      selectedLeft: 'l-1',
    });
    expect(updateMatchingAnswer({ 'l-0': 'r-0', selectedLeft: 'l-1' }, 'l-1', 'left')).toEqual({
      'l-0': 'r-0',
    });
  });

  it('moves an ordering rank to the newly edited item', () => {
    expect(updateOrderingRanks({ 'item-0': 1, 'item-1': 2 }, 'item-1', 1)).toEqual({
      'item-1': 1,
    });
  });

  it('clears an ordering rank without disturbing other items', () => {
    expect(updateOrderingRanks({ 'item-0': 1, 'item-1': 2 }, 'item-1', null)).toEqual({
      'item-0': 1,
    });
  });
});
