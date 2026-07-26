import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ claimResultReward: vi.fn() }));
vi.mock('../src/services/gamificationService', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('../src/services/gamificationService');
  return { ...actual, claimResultReward: mocks.claimResultReward };
});

import { useGamificationStore } from '../src/stores/useGamificationStore';

describe('gamification result reward store', () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.claimResultReward.mockReset();
    useGamificationStore.setState({
      pet: {
        petId: 'cat_01',
        petName: 'Mèo Con',
        level: 1,
        exp: 20,
        expToNext: 100,
        mood: 'happy',
        items: [],
        lastActive: new Date().toISOString(),
      },
      coins: 50,
      shopItems: [],
      lastReward: null,
      error: null,
      isLoading: false,
    });
  });

  it('hydrates local gamification state from the server-owned result reward', async () => {
    mocks.claimResultReward.mockResolvedValue({
      awardedExp: 60,
      awardedCoins: 15,
      alreadyClaimed: false,
      newLevel: 1,
      newExp: 80,
      newExpToNext: 100,
      newCoins: 65,
      leveledUp: false,
      mood: 'excited',
    });

    const reward = await useGamificationStore.getState().claimResultReward('student-a', '42');
    const state = useGamificationStore.getState();

    expect(mocks.claimResultReward).toHaveBeenCalledWith('student-a', '42');
    expect(reward?.awardedExp).toBe(60);
    expect(state.pet).toMatchObject({ level: 1, exp: 80, expToNext: 100, mood: 'excited' });
    expect(state.coins).toBe(65);
    expect(state.lastReward).toEqual({ exp: 60, coins: 15, leveledUp: false, newLevel: 1 });
  });

  it('returns null and preserves the current balances when the claim fails', async () => {
    mocks.claimResultReward.mockResolvedValue(null);

    const reward = await useGamificationStore.getState().claimResultReward('student-a', '42');
    const state = useGamificationStore.getState();

    expect(reward).toBeNull();
    expect(state.coins).toBe(50);
    expect(state.pet?.exp).toBe(20);
    expect(state.error).toBe('Không thể đồng bộ phần thưởng.');
  });
});
