import React from 'react';
import CompetitionDashboardPage from '../../src/features/competition/CompetitionDashboardPage';
import { RoundsSection } from '../../src/features/competition/dashboard/RoundsSection';
import { CampaignAudienceSection } from '../../src/features/competition/dashboard/CampaignAudienceSection';
import type { CampaignDraft, RoundDraft } from '../../src/features/competition/dashboard/dashboardTypes';

const headings = [
  'Chiến dịch & đối tượng', '6 vòng thi', 'Điều kiện dự thi', 'Thi cấp trường',
  'Đối soát', 'Công bố & xếp hạng', 'Chứng nhận & XLSX',
];

const assertNoPageOverflow = () => cy.document().then((document) => {
  const viewport = document.documentElement.clientWidth;
  const offenders = Array.from(document.querySelectorAll<HTMLElement>('article, input, button'))
    .map(element => ({ tag: element.tagName, label: element.getAttribute('aria-label'), right: element.getBoundingClientRect().right }))
    .filter(element => element.right > viewport + 1);
  expect(document.documentElement.scrollWidth, JSON.stringify(offenders)).to.be.lte(viewport + 1);
});

function PopulatedRound() {
  const [draft, setDraft] = React.useState<RoundDraft>({
    roundId: 'round-1', opensAt: '2026-11-25T08:30', closesAt: '2026-11-25T09:30', maxAttempts: '2', passingScore: '7',
  });
  return (
    <main className="w-full p-4">
      <RoundsSection
        isAdmin
        rounds={[{ id: 'round-1', campaignId: 'campaign-1', roundNumber: 1, opensAt: '', closesAt: '', maxAttempts: 2, passingScore: 7, status: 'CLOSED' }]}
        roundDrafts={{ 1: draft }}
        roundQuizDrafts={{ 1: { gradeLevel: '4', classId: 'class-4a', quizId: 'quiz-1' } }}
        loadingDetails={false}
        pendingAction={null}
        selectedCampaign={{ id: 'campaign-1', title: 'Cuộc thi', schoolYear: '2026-2027', timezone: 'Asia/Ho_Chi_Minh', status: 'ACTIVE' }}
        updateRoundDraft={(_round, patch) => setDraft(current => ({ ...current, ...patch }))}
        updateRoundQuizDraft={() => {}}
        saveRound={async () => {}}
        finalizeRound={async () => {}}
        saveRoundQuiz={async () => {}}
      />
    </main>
  );
}

function PopulatedCampaign() {
  const [draft, setDraft] = React.useState<CampaignDraft>({
    title: 'Cuộc thi', schoolYear: '2026-2027', timezone: 'Asia/Ho_Chi_Minh', gradeLevels: '4', classIds: 'class-4a', requiredPassedRounds: '6', startsAt: '2026-11-25T08:30', endsAt: '2026-11-26T09:30',
  });
  const campaign = { id: 'campaign-1', title: 'Cuộc thi', schoolYear: '2026-2027', timezone: 'Asia/Ho_Chi_Minh', status: 'DRAFT' };
  return (
    <main className="w-full p-4">
      <CampaignAudienceSection
        isAdmin campaigns={[campaign]} selectedCampaignId={campaign.id} selectedCampaign={campaign}
        loadingCampaigns={false} loadingDetails={false} pendingAction={null} campaignDraft={draft} audiencePreview={null}
        setSelectedCampaignId={() => {}} setAudiencePreview={() => {}} setAudienceFreezeConfirmOpen={() => {}}
        setCampaignDraft={setDraft} persistCampaign={async () => {}} previewAudience={async () => {}}
      />
    </main>
  );
}

describe('competition dashboard responsive composition', () => {
  for (const width of [320, 768, 1440]) {
    for (const isAdmin of [true, false]) {
      it(`preserves ${isAdmin ? 'admin' : 'teacher'} controls at ${width}px`, () => {
        cy.viewport(width, 1000);
        cy.intercept('GET', '**/api/**', { statusCode: 200, body: { items: [] } });
        cy.mount(<main className="w-full p-4"><CompetitionDashboardPage isAdmin={isAdmin} /></main>);
        cy.contains('h1', 'Cuộc thi').should('be.visible');
        for (const heading of headings) cy.contains('h2', heading).should('exist');
        cy.contains('button', isAdmin ? 'Xuất XLSX toàn trường' : 'Xuất XLSX theo lớp').should('exist');
        if (isAdmin) {
          cy.contains('button', 'Xem trước đối tượng').should('exist').and('be.disabled');
        } else {
          cy.contains('button', 'Xem trước đối tượng').should('not.exist');
          cy.contains('button', 'Xuất XLSX toàn trường').should('not.exist');
        }
        assertNoPageOverflow();
      });
    }
  }

  it('keeps populated round fields inside their card and editable at 320px', () => {
    cy.viewport(320, 1000);
    cy.mount(<PopulatedRound />);
    cy.get('input[aria-label="Mở vòng 1"]').should('have.value', '2026-11-25T08:30')
      .clear().type('2026-11-26T10:45').should('have.value', '2026-11-26T10:45');
    cy.get('input[aria-label="Đóng vòng 1"]').should('have.value', '2026-11-25T09:30');
    cy.get('input[aria-label="Số lượt tối đa vòng 1"]').type('{selectall}3').should('have.value', '3');
    cy.get('input').each(($input) => {
      const label = $input[0].closest('label')!;
      const bounds = label.getBoundingClientRect();
      const rect = $input[0].getBoundingClientRect();
      expect(rect.left).to.be.gte(bounds.left - 1);
      expect(rect.right).to.be.lte(bounds.right + 1);
      const card = label.closest('.rounded-xl')!;
      expect(rect.right).to.be.lte(card.getBoundingClientRect().right - 10);
    });
    cy.contains('button', 'Lưu vòng 1').scrollIntoView().should('be.visible').and('not.be.disabled');
    cy.contains('button', 'Chốt vòng 1').should('exist').and('not.be.disabled');
    assertNoPageOverflow();
  });

  it('keeps populated campaign inputs within the form at 320px', () => {
    cy.viewport(320, 1000);
    cy.mount(<PopulatedCampaign />);
    cy.get('input[type="datetime-local"]').first().should('have.value', '2026-11-25T08:30')
      .clear().type('2026-11-27T10:45').should('have.value', '2026-11-27T10:45');
    cy.get('input').each(($input) => {
      const label = $input[0].closest('label')!;
      const rect = $input[0].getBoundingClientRect();
      expect(rect.right).to.be.lte(label.getBoundingClientRect().right + 1);
      const form = label.closest('.rounded-xl')!;
      expect(rect.right).to.be.lte(form.getBoundingClientRect().right - 10);
    });
    assertNoPageOverflow();
  });
});
