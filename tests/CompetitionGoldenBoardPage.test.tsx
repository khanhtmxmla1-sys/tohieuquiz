import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  PublicGoldenBoardDto,
  PublicGoldenBoardWinnerDto,
} from '../shared/competition-portal.contract';
import CompetitionGoldenBoardPage from '../src/features/competition/portal/public/CompetitionGoldenBoardPage';

const mocks = vi.hoisted(() => ({
  getGoldenBoard: vi.fn(),
}));

vi.mock('../src/features/competition/portal/public/publicCompetitionPortalService', () => ({
  publicCompetitionPortalService: mocks,
}));

const winner = (
  fullName: string,
  awardCode: string,
  awardLabel: string,
  gradeLevel = 5,
): PublicGoldenBoardWinnerDto => ({
  fullName,
  className: `${gradeLevel}A1`,
  schoolName: 'Trường Tiểu học Tô Hiệu',
  gradeLevel,
  awardCode,
  awardLabel,
});

const board = (
  publicationVersion: number,
  winners: PublicGoldenBoardWinnerDto[],
): PublicGoldenBoardDto => ({
  winners,
  publicationVersion,
  rankingVersion: publicationVersion,
  awardRuleVersion: 1,
  publishedAt: `2026-08-${String(publicationVersion).padStart(2, '0')}T00:00:00.000Z`,
});

const renderBoard = () => render(
  <MemoryRouter initialEntries={['/cuoc-thi/san-choi-2026/bang-vang']}>
    <Routes>
      <Route
        path="/cuoc-thi/:campaignSlug/bang-vang"
        element={<CompetitionGoldenBoardPage />}
      />
    </Routes>
  </MemoryRouter>,
);

describe('Competition Golden Board page', () => {
  beforeEach(() => {
    mocks.getGoldenBoard.mockReset();
  });

  it('renders only the privacy-safe winner allowlist in server-provided award order', async () => {
    const first = winner('Nguyễn Minh An', 'FIRST', 'Giải Nhất');
    const second = winner('Trần Bảo Châu', 'FIRST', 'Giải Nhất');
    const third = winner('Lê Hoàng Nam', 'SECOND', 'Giải Nhì', 6);
    mocks.getGoldenBoard.mockResolvedValue(board(7, [first, second, third]));

    renderBoard();

    expect(await screen.findByRole('heading', { level: 1, name: 'Bảng vàng' })).toBeInTheDocument();
    const awardHeadings = screen.getAllByRole('heading', { level: 2 });
    expect(awardHeadings.map((heading) => heading.textContent)).toEqual(['Giải Nhất', 'Giải Nhì']);
    expect(screen.getByText(first.fullName)).toBeInTheDocument();
    expect(screen.getAllByText(first.className)).not.toHaveLength(0);
    expect(screen.getAllByText(first.schoolName)).not.toHaveLength(0);
    expect(screen.getAllByText(String(first.gradeLevel))).not.toHaveLength(0);
    expect(screen.getAllByText(first.awardLabel)).not.toHaveLength(0);

    const firstAward = screen.getByRole('region', { name: 'Giải Nhất' });
    expect(within(firstAward).getAllByRole('listitem')).toHaveLength(2);
    expect(firstAward.textContent?.indexOf(first.fullName)).toBeLessThan(
      firstAward.textContent?.indexOf(second.fullName) ?? 0,
    );

    expect(screen.queryByText('98765')).not.toBeInTheDocument();
    expect(screen.queryByText('student-internal-1')).not.toBeInTheDocument();
    expect(screen.queryByText('username-internal-1')).not.toBeInTheDocument();
    expect(screen.queryByText('ROOM-PRIVATE-1')).not.toBeInTheDocument();
    expect(mocks.getGoldenBoard).toHaveBeenCalledWith('san-choi-2026');
  });

  it('shows a friendly empty state for a disabled or unpublished board', async () => {
    mocks.getGoldenBoard.mockResolvedValue(board(8, []));

    renderBoard();

    expect(await screen.findByText(/bảng vàng chưa có danh sách được công bố/i)).toBeInTheDocument();
    expect(screen.queryByText(/publicationVersion|rankingVersion|awardRuleVersion/i)).not.toBeInTheDocument();
  });

  it('does not leak the reason when the public board is unavailable', async () => {
    mocks.getGoldenBoard.mockRejectedValue(new Error('PRIVATE_GOLDEN_BOARD_SOURCE_DETAILS'));

    renderBoard();

    expect(await screen.findByRole('alert')).toHaveTextContent(/không tìm thấy|tạm thời chưa khả dụng/i);
    expect(screen.queryByText('PRIVATE_GOLDEN_BOARD_SOURCE_DETAILS')).not.toBeInTheDocument();
    expect(screen.queryByText(/score|rank|studentId|room|publication/i)).not.toBeInTheDocument();
  });

  it('renders the replacement winner set after a correction republish refetch', async () => {
    const originalWinner = winner('Nguyễn Minh An', 'FIRST', 'Giải Nhất');
    const replacementWinner = winner('Phạm Thu Hà', 'FIRST', 'Giải Nhất');
    mocks.getGoldenBoard.mockResolvedValue(board(9, [originalWinner]));

    renderBoard();

    expect(await screen.findByText(originalWinner.fullName)).toBeInTheDocument();
    mocks.getGoldenBoard.mockResolvedValue(board(10, [replacementWinner]));

    fireEvent.click(screen.getByRole('button', { name: /tải lại bảng vàng/i }));

    expect(await screen.findByText(replacementWinner.fullName)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText(originalWinner.fullName)).not.toBeInTheDocument();
    });
    expect(mocks.getGoldenBoard).toHaveBeenCalledTimes(2);
  });
});
