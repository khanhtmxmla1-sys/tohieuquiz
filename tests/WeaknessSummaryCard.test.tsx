import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import WeaknessSummaryCard from '../src/components/student/ResultScreen/WeaknessSummaryCard';
import { fetchWeaknessProfile } from '../src/services/weaknessProfileService';
import {
    makeWeaknessProfileEmpty,
    makeWeaknessProfileLowCoverage,
    makeWeaknessProfileNeedsPracticeOnly,
    makeWeaknessProfileSuccess,
    makeWeaknessProfileWeak,
} from './fixtures/weaknessProfile.fixtures';

vi.mock('../src/services/weaknessProfileService', () => ({
    fetchWeaknessProfile: vi.fn(),
}));

const mockedFetchWeaknessProfile = vi.mocked(fetchWeaknessProfile);

function renderCard(props: Partial<React.ComponentProps<typeof WeaknessSummaryCard>> = {}) {
    const onOpenDrOwl = vi.fn();
    const onOpenRecommendations = vi.fn();

    render(
        <WeaknessSummaryCard
            resultId="301"
            scorePct={40}
            wrongQuestionIds={['q1', 'q2', 'q3']}
            onOpenDrOwl={onOpenDrOwl}
            onOpenRecommendations={onOpenRecommendations}
            {...props}
        />,
    );

    return {
        onOpenDrOwl,
        onOpenRecommendations,
    };
}

describe('WeaknessSummaryCard', () => {
    beforeEach(() => {
        mockedFetchWeaknessProfile.mockReset();
    });

    it('shows loading state while weakness profile is pending', () => {
        mockedFetchWeaknessProfile.mockImplementation(() => new Promise(() => undefined));

        renderCard();

        expect(screen.getByText('Con can luyen them')).toBeInTheDocument();
        expect(screen.getByText('He thong dang xem bai lam cua con...')).toBeInTheDocument();
    });

    it('renders weak skills with priority badge and accuracy', async () => {
        mockedFetchWeaknessProfile.mockResolvedValue(makeWeaknessProfileWeak());

        renderCard();

        expect(await screen.findByText('Phan so')).toBeInTheDocument();
        expect(screen.getAllByText('Can uu tien').length).toBeGreaterThan(0);
        expect(screen.getByText('40%')).toBeInTheDocument();
    });

    it('renders needs_practice state with softer CTA label', async () => {
        mockedFetchWeaknessProfile.mockResolvedValue(makeWeaknessProfileNeedsPracticeOnly());

        renderCard({
            scorePct: 70,
            wrongQuestionIds: ['q1'],
        });

        expect(await screen.findByText('Luyen tu va cau')).toBeInTheDocument();
        expect(screen.getByText('Can luyen them')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /On luyen tu va cau/i })).toBeInTheDocument();
    });

    it('shows low coverage warning when profile coverage is weak', async () => {
        mockedFetchWeaknessProfile.mockResolvedValue(makeWeaknessProfileLowCoverage());

        renderCard({
            scorePct: 68,
            wrongQuestionIds: ['q1'],
        });

        expect(await screen.findByText(/He thong dang hoc them tu bai lam cua con/i)).toBeInTheDocument();
    });

    it('shows positive empty state when no focus skills remain', async () => {
        mockedFetchWeaknessProfile.mockResolvedValue(makeWeaknessProfileEmpty());

        const { onOpenRecommendations } = renderCard({
            scorePct: 85,
            wrongQuestionIds: [],
        });

        expect(await screen.findByText(/Con dang lam kha tot roi!/i)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /Xem goi y hoc/i }));
        expect(onOpenRecommendations).toHaveBeenCalledWith(null);
    });

    it('shows error state and fallback CTA when service fails', async () => {
        mockedFetchWeaknessProfile.mockRejectedValue(new Error('Tai profile that bai'));

        const { onOpenRecommendations } = renderCard({
            scorePct: 85,
            wrongQuestionIds: [],
        });

        expect(await screen.findByText('Tai profile that bai')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /Xem goi y hoc/i }));
        expect(onOpenRecommendations).toHaveBeenCalledTimes(1);
        expect(onOpenRecommendations).toHaveBeenCalledWith(null);
    });

    it('routes primary CTA to DrOwl for low score with many wrong answers', async () => {
        mockedFetchWeaknessProfile.mockResolvedValue(makeWeaknessProfileSuccess());

        const { onOpenDrOwl, onOpenRecommendations } = renderCard({
            scorePct: 40,
            wrongQuestionIds: ['q1', 'q2', 'q3'],
        });

        const actionButtons = await screen.findAllByRole('button', { name: /Luyen ngay voi Cu Meo/i });
        fireEvent.click(actionButtons[0]);

        expect(onOpenDrOwl).toHaveBeenCalledTimes(1);
        expect(onOpenRecommendations).not.toHaveBeenCalled();
    });

    it('routes primary CTA to recommendations when score does not need DrOwl', async () => {
        mockedFetchWeaknessProfile.mockResolvedValue(makeWeaknessProfileNeedsPracticeOnly());

        const { onOpenDrOwl, onOpenRecommendations } = renderCard({
            scorePct: 78,
            wrongQuestionIds: ['q1'],
        });

        fireEvent.click(await screen.findByRole('button', { name: /On luyen tu va cau/i }));

        expect(onOpenRecommendations).toHaveBeenCalledTimes(1);
        expect(onOpenRecommendations).toHaveBeenCalledWith(expect.objectContaining({
            subjectId: 'tieng-viet',
            skillCode: 'luyen_tu_va_cau',
            skillLabel: 'Luyen tu va cau',
        }));
        expect(onOpenDrOwl).not.toHaveBeenCalled();
    });

    it('falls back to API skillLabel when local copy is missing', async () => {
        const profile = makeWeaknessProfileSuccess();
        profile.subjects[0].skills = [
            {
                ...profile.subjects[0].skills[0],
                skillCode: 'unknown_skill',
                skillLabel: 'Ky nang dac biet',
            },
        ];
        mockedFetchWeaknessProfile.mockResolvedValue(profile);

        renderCard({
            scorePct: 70,
            wrongQuestionIds: ['q1'],
        });

        expect(await screen.findByText('Ky nang dac biet')).toBeInTheDocument();
    });

    it('limits displayed focus skills to top three', async () => {
        const profile = makeWeaknessProfileWeak();
        profile.subjects[0].skills.push(
            {
                subject: 'math',
                subjectLabel: 'Toan',
                skillCode: 'toan_co_loi_van',
                skillLabel: 'Toan co loi van',
                attempted: 3,
                correct: 0,
                wrong: 3,
                accuracy: 0,
                status: 'weak',
            },
            {
                subject: 'vietnamese',
                subjectLabel: 'Tieng Viet',
                skillCode: 'tu_vung',
                skillLabel: 'Tu vung',
                attempted: 3,
                correct: 1,
                wrong: 2,
                accuracy: 33,
                status: 'weak',
            },
        );
        mockedFetchWeaknessProfile.mockResolvedValue(profile);

        renderCard();

        expect(await screen.findByText('Tu vung')).toBeInTheDocument();
        expect(screen.queryByText('Doc hieu')).not.toBeInTheDocument();
    });
});
