import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import SmartAssignmentInsightCard, {
    type SmartAssignmentInsightViewModel,
} from '../src/components/TeacherDashboard/SmartAssignmentInsightCard';

function renderCard(overrides: Partial<SmartAssignmentInsightViewModel> = {}) {
    const model: SmartAssignmentInsightViewModel = {
        state: 'recommended',
        source: 'smart-preview',
        title: 'Intervention summary',
        summary: 'Nen giao de "On luyen phan so co ban" de luyen Phan so.',
        skillLabel: 'Phan so',
        subskillLabel: 'Rut gon phan so',
        statusLabel: 'Can uu tien',
        accuracy: 25,
        targetDifficultyLabel: 'Muc muc tieu 1 - De',
        matchReason: 'Khop sat subskill Rut gon phan so',
        confidencePercent: 95,
        className: '2A',
        studentName: 'Lan',
        quizTitle: 'On luyen phan so co ban',
        warningMessages: [],
        manualNotice: null,
        ...overrides,
    };

    return render(<SmartAssignmentInsightCard model={model} />);
}

describe('SmartAssignmentInsightCard', () => {
    it('renders recommended state with action-ready copy', () => {
        renderCard();

        expect(screen.getByText(/San sang giao bai/i)).toBeInTheDocument();
        expect(screen.getAllByText(/Phan so/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/Rut gon phan so/i).length).toBeGreaterThan(0);
        expect(screen.getByText(/^95%$/i)).toBeInTheDocument();
        expect(screen.getByText(/Goi y nay da du ro de thay co giao bai ngay/i)).toBeInTheDocument();
    });

    it('renders review state with warning messages', () => {
        renderCard({
            state: 'review',
            warningMessages: [
                'Do phu metadata hien tai la 72%, nen xem lai nhanh truoc khi giao.',
            ],
        });

        expect(screen.getAllByText(/Nen xem lai/i).length).toBeGreaterThan(0);
        expect(screen.getByText(/Do phu metadata hien tai la 72%/i)).toBeInTheDocument();
    });

    it('renders low-confidence state and manual notice together', () => {
        renderCard({
            state: 'low-confidence',
            confidencePercent: 45,
            warningMessages: [
                'Goi y nay co do tin cay thap, nen duoc teacher xem lai truoc khi giao.',
            ],
            manualNotice: 'He thong da giu lai ky nang muc tieu de thay co doi chieu.',
        });

        expect(screen.getAllByText(/Do tin cay thap/i).length).toBeGreaterThan(0);
        expect(screen.getByText(/He thong da giu lai ky nang muc tieu de thay co doi chieu/i)).toBeInTheDocument();
        expect(screen.getByText(/^45%$/i)).toBeInTheDocument();
    });

    it('renders manual-adjusted state with fallback confidence copy', () => {
        renderCard({
            state: 'manual-adjusted',
            confidencePercent: undefined,
            summary: 'Ban da chinh de bai hoac doi tuong khac so voi goi y ban dau.',
            quizTitle: 'On tap tong hop cuoi tuan',
        });

        expect(screen.getByText(/Da chinh tay/i)).toBeInTheDocument();
        expect(screen.getByText(/Can teacher xac nhan/i)).toBeInTheDocument();
        expect(screen.getByText(/On tap tong hop cuoi tuan/i)).toBeInTheDocument();
    });
});
