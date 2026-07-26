import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import RewardOverlay from '../src/components/gamification/RewardOverlay';
import type { CompletionRewardData } from '../src/features/quiz-player/hooks/useQuizPlayer';

const makeReward = (overrides: Partial<CompletionRewardData> = {}): CompletionRewardData => ({
  status: 'ready',
  resultId: '42',
  score: 0,
  correctCount: 0,
  totalQuestions: 1,
  expEarned: 10,
  coinsEarned: 0,
  newLevel: 1,
  newExp: 30,
  newExpToNext: 100,
  newCoins: 50,
  leveledUp: false,
  isPractice: false,
  ...overrides,
});

describe('RewardOverlay', () => {
  it('shows an encouraging completion summary even at zero correct', () => {
    render(
      <RewardOverlay
        data={makeReward()}
        onViewResult={vi.fn()}
        onExit={vi.fn()}
        onRetryReward={vi.fn()}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Chúc mừng em đã hoàn thành bài tập!' })).toBeInTheDocument();
    expect(screen.getByText('0/10')).toBeInTheDocument();
    expect(screen.getByText('0/1 câu đúng')).toBeInTheDocument();
    expect(screen.getByText('+10 EXP')).toBeInTheDocument();
    expect(screen.getByText('+0 xu')).toBeInTheDocument();
    expect(screen.getByText('Cấp 1')).toBeInTheDocument();
  });

  it('shows a retry action without hiding the saved result when reward sync fails', () => {
    const onRetryReward = vi.fn();
    render(
      <RewardOverlay
        data={makeReward({ status: 'error', expEarned: 0 })}
        onViewResult={vi.fn()}
        onExit={vi.fn()}
        onRetryReward={onRetryReward}
      />,
    );

    expect(screen.getByText('Kết quả của em đã được lưu.')).toBeInTheDocument();
    expect(screen.getByText('Phần thưởng chưa đồng bộ được.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Thử đồng bộ lại' }));
    expect(onRetryReward).toHaveBeenCalledTimes(1);
  });

  it('shows level-up feedback and both navigation actions', () => {
    const onViewResult = vi.fn();
    const onExit = vi.fn();
    render(
      <RewardOverlay
        data={makeReward({ score: 10, correctCount: 1, expEarned: 90, coinsEarned: 30, newLevel: 2, newExp: 20, newExpToNext: 120, leveledUp: true })}
        onViewResult={onViewResult}
        onExit={onExit}
        onRetryReward={vi.fn()}
      />,
    );

    expect(screen.getByText('Em đã lên Cấp 2!')).toBeInTheDocument();
    expect(screen.getByTestId('completion-celebration')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Xem kết quả' }));
    fireEvent.click(screen.getByRole('button', { name: 'Về trang chủ' }));
    expect(onViewResult).toHaveBeenCalledTimes(1);
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('labels practice completion without claiming a reward', () => {
    render(
      <RewardOverlay
        data={makeReward({ isPractice: true, expEarned: 0, coinsEarned: 0 })}
        onViewResult={vi.fn()}
        onExit={vi.fn()}
        onRetryReward={vi.fn()}
      />,
    );

    expect(screen.getByText('Bài luyện tập đã hoàn thành')).toBeInTheDocument();
    expect(screen.getByText('Bài luyện tập không cộng EXP hoặc xu.')).toBeInTheDocument();
  });
});
