import { describe, expect, it } from 'vitest';
import { createCompetitionArticleTemplate } from '../src/features/competition/public-content/competitionArticleTemplates';

const context = {
  campaign: {
    id: 'campaign-1', title: 'Trạng Nguyên Nhí', schoolYear: '2026-2027', timezone: 'Asia/Ho_Chi_Minh', status: 'PUBLISHED',
    audienceRule: { gradeLevels: [4, 5], classIds: ['4A', '5B'] },
    eligibilityPolicy: { requiredRounds: 6 as const, requiredPassedRounds: 5 },
  },
  rounds: [
    { id: 'round-2', campaignId: 'campaign-1', roundNumber: 2, opensAt: '2026-09-01T09:00:00.000Z', closesAt: '2026-09-07T16:00:00.000Z', maxAttempts: 3, passingScore: 8, status: 'SCHEDULED' },
    { id: 'round-1', campaignId: 'campaign-1', roundNumber: 1, opensAt: '2026-08-25T09:00:00.000Z', closesAt: '2026-08-31T16:00:00.000Z', maxAttempts: 2, passingScore: 7, status: 'SCHEDULED' },
  ],
};

describe('competition article templates', () => {
  it('creates canonical rules content without unsupported policy claims', () => {
    const template = createCompetitionArticleTemplate('RULES', context);

    expect(template).toMatchObject({ type: 'RULES', title: 'Thể lệ Trạng Nguyên Nhí', slug: 'the-le-trang-nguyen-nhi' });
    expect(template?.content).toContain('Năm học: 2026-2027');
    expect(template?.content).toContain('Khối: 4, 5');
    expect(template?.content).toContain('Lớp: 4A, 5B');
    expect(template?.content).toContain('Cần đạt: 5/6 vòng thi');
    expect(template?.content).not.toMatch(/Giải|Thời lượng|hotline/i);
  });

  it('creates a sorted schedule with exact round windows and limits', () => {
    const template = createCompetitionArticleTemplate('SCHEDULE', {
      ...context,
      rounds: [...context.rounds, {
        id: 'foreign-round-1', campaignId: 'campaign-other', roundNumber: 1,
        opensAt: '2026-07-01T09:00:00.000Z', closesAt: '2026-07-07T16:00:00.000Z',
        maxAttempts: 99, passingScore: 99, status: 'SCHEDULED',
      }],
    });

    expect(template?.content.indexOf('### Vòng 1')).toBeLessThan(template?.content.indexOf('### Vòng 2'));
    expect(template?.content).toContain('Mở: 25/08/2026 16:00');
    expect(template?.content).toContain('Đóng: 31/08/2026 23:00');
    expect(template?.content).toContain('Số lượt tối đa: 2');
    expect(template?.content).toContain('Điểm đạt: 7');
    expect(template?.content).not.toContain('01/07/2026 16:00');
    expect(template?.content).not.toContain('Số lượt tối đa: 99');
  });

  it('creates a guide template and returns null for unsupported article types', () => {
    const template = createCompetitionArticleTemplate('GUIDE', context);

    expect(template?.title).toBe('Hướng dẫn tham gia Trạng Nguyên Nhí');
    expect(template?.content).toContain('Thông tin thời gian, số lượt tối đa');
    expect(createCompetitionArticleTemplate('AWARD', context)).toBeNull();
  });

  it('does not invent a qualification threshold when the campaign policy is missing', () => {
    const template = createCompetitionArticleTemplate('RULES', {
      ...context,
      campaign: { ...context.campaign, eligibilityPolicy: undefined },
    });

    expect(template?.content).toContain('Cần đạt: Chưa cấu hình.');
    expect(template?.content).not.toContain('6/6');
  });
});
